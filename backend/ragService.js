import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import * as cheerio from 'cheerio';
import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { OpenAI } from 'openai';

let geminiClient = null;
let openaiClient = null;

function getGemini() {
  if (!geminiClient && process.env.GEMINI_API_KEY) geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return geminiClient;
}

function getOpenAI() {
  if (!openaiClient && process.env.OPENAI_API_KEY) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Divide el texto en chunks de ~1000 caracteres con un overlap de ~200
function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let startIndex = 0;
  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;
    // Evitar cortar palabras a la mitad si es posible
    if (endIndex < text.length) {
      const lastSpace = text.lastIndexOf(' ', endIndex);
      if (lastSpace > startIndex) {
        endIndex = lastSpace;
      }
    }
    chunks.push(text.slice(startIndex, endIndex).trim());
    startIndex = endIndex - overlap;
  }
  return chunks.filter(c => c.length > 50); // Ignorar chunks muy pequeños
}

// Extrae texto de un buffer PDF
export async function extractTextFromPDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new Error('Error parseando PDF: ' + error.message);
  }
}

// Extrae texto de un buffer Markdown
export function extractTextFromMD(buffer) {
  return buffer.toString('utf8');
}

// Scrapea y extrae texto limpio de una URL
export async function extractTextFromURL(url) {
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KudenBot/1.0' }
    });
    const $ = cheerio.load(data);
    // Eliminar scripts, estilos, nav, footer, etc.
    $('script, style, noscript, nav, footer, header, iframe').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    if (!text) throw new Error('No se pudo extraer texto legible de la web.');
    return text;
  } catch (error) {
    throw new Error('Error extrayendo web: ' + error.message);
  }
}

// Generar Embedding (Gemini 768 por defecto, fallback a OpenAI 768)
export async function generateEmbedding(text, provider = 'gemini') {
  if (provider === 'gemini' && getGemini()) {
    try {
      const response = await getGemini().models.embedContent({
        model: 'gemini-embedding-2',
        contents: text,
        config: { outputDimensionality: 768 }
      });
      return response.embeddings[0].values;
    } catch (e) {
      console.warn("Fallo en Gemini embedding, intentando OpenAI como fallback...", e.message);
      if (getOpenAI()) provider = 'openai';
      else throw e;
    }
  }

  if (provider === 'openai' && getOpenAI()) {
    const response = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 768, // Forzamos 768 para compatibilidad estructural con DB
    });
    return response.data[0].embedding;
  }

  throw new Error("No hay clientes API configurados para Embeddings.");
}

// Procesa una fuente (buffer/url) y guarda en Supabase
export async function processAndStoreKnowledge({ supabase, tenantId, profileId, name, type, source, provider = 'gemini' }) {
  let text = '';
  
  if (type === 'pdf') {
    text = await extractTextFromPDF(source);
  } else if (type === 'md') {
    text = extractTextFromMD(source);
  } else if (type === 'web') {
    text = await extractTextFromURL(source);
  } else {
    throw new Error('Tipo de fuente no soportado: ' + type);
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error("El documento no contiene texto válido.");

  // 1. Crear registro en knowledge_documents
  const { data: docRecord, error: docErr } = await supabase
    .from('knowledge_documents')
    .insert([{ tenant_id: tenantId, profile_id: profileId, name, source_type: type }])
    .select('id')
    .single();

  if (docErr) throw docErr;
  const documentId = docRecord.id;

  // 2. Generar embeddings y guardar chunks
  const chunkRows = [];
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk, provider);
    
    // Convertimos el array a string '[val1, val2]' para que pgvector lo inserte directo
    const embeddingString = `[${embedding.join(',')}]`;
    chunkRows.push({
      tenant_id: tenantId,
      profile_id: profileId,
      document_id: documentId,
      content: chunk,
      embedding: embeddingString
    });
    
    await sleep(1000); // Esperar 1s entre cada llamada para evitar rate-limits (HTTP 429) de las capas gratuitas
  }

  // Insertamos en lotes si son muchos (para este caso lo hacemos directo)
  const { error: chunkErr } = await supabase.from('document_chunks').insert(chunkRows);
  if (chunkErr) {
    // Rollback
    await supabase.from('knowledge_documents').delete().eq('id', documentId);
    throw chunkErr;
  }

  return { documentId, chunksCount: chunks.length };
}

// Función principal para consultar la Base de Conocimientos RAG
export async function retrieveKnowledge(query, supabase, tenantId, profileId, provider = 'gemini') {
  try {
    // 1. Convertir la pregunta en un vector (Embedding)
    const queryEmbedding = await generateEmbedding(query, provider);
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // 2. Buscar en Supabase usando la función RPC
    const { data: chunks, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: embeddingString,
      match_threshold: 0.65, // Coincidencia mínima del 65% de similitud semántica
      match_count: 5,        // Traer hasta 5 fragmentos relevantes
      p_tenant_id: tenantId,
      p_profile_id: profileId
    });

    if (error) {
      console.error("Error al buscar fragmentos RAG:", error);
      return ""; // No romper el chat si falla el RAG
    }

    if (!chunks || chunks.length === 0) {
      return "";
    }

    // 3. Unir los fragmentos en un solo texto continuo
    const contextText = chunks.map((chunk, index) => {
      return `--- FRAGMENTO ${index + 1} ---\n${chunk.content}`;
    }).join('\n\n');

    return contextText;

  } catch (error) {
    console.error("Error en retrieveKnowledge:", error);
    return "";
  }
}

/**
 * eval_cas_mercurio.mjs
 * Harness de evaluación del agente CAS de El Mercurio.
 *
 * Para cada caso de casos_cas_mercurio.json:
 *   1. Construye el system prompt con buildSystem(contexto).
 *   2. Envía la entrada del suscriptor al AGENTE (modelo bajo prueba).
 *   3. Un modelo JUEZ compara la respuesta con el "esperado" → PASA / FALLA.
 * Imprime un reporte y guarda un JSON. Sale con código 1 si falla algún caso bloqueante.
 *
 * Requisitos:
 *   - Node 18+
 *   - npm i @anthropic-ai/sdk
 *   - Variable de entorno ANTHROPIC_API_KEY
 *   - Archivos en la misma carpeta: buildSystem_CAS_Mercurio.js y casos_cas_mercurio.json
 *
 * NOTA ESM: este archivo es .mjs (ESM). El buildSystem se importa como ESM;
 * si tu proyecto NO tiene "type":"module", renombra buildSystem_CAS_Mercurio.js
 * a .mjs y ajusta el import de abajo.
 *
 * Uso:
 *   node eval_cas_mercurio.mjs
 *   node eval_cas_mercurio.mjs --solo=D            (corre solo casos cuyo id empieza con D)
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import buildSystem from "./buildSystem_CAS_Mercurio.js";

// ----------------------- Configuración -----------------------
const AGENT_MODEL = "claude-sonnet-4-6"; // modelo bajo prueba (el que usa tu simulador)
const JUDGE_MODEL = "claude-opus-4-8";   // juez estricto
const AGENT_MAX_TOKENS = 800;
const JUDGE_MAX_TOKENS = 400;
const DELAY_MS = 400;                     // pausa entre llamadas para no topar rate limits
// -------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const client = new Anthropic(); // toma ANTHROPIC_API_KEY del entorno

const filtro = (process.argv.find((a) => a.startsWith("--solo=")) || "").split("=")[1] || "";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function textoDe(msg) {
  return (msg.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function parseVeredicto(raw) {
  // Limpia posibles fences ```json ... ``` y extrae el primer objeto JSON.
  let t = raw.replace(/```json|```/g, "").trim();
  const m = t.match(/\{[\s\S]*\}/);
  if (m) t = m[0];
  try {
    const o = JSON.parse(t);
    const v = String(o.veredicto || "").toUpperCase();
    return { veredicto: v === "PASA" ? "PASA" : "FALLA", motivo: o.motivo || "" };
  } catch {
    // Si el juez no devolvió JSON válido, lo tratamos como fallo para revisión manual.
    return { veredicto: "FALLA", motivo: "Juez no devolvió JSON válido: " + raw.slice(0, 200) };
  }
}

const JUDGE_SYSTEM = `Eres un evaluador estricto de calidad de un agente de atención al cliente (CAS de El Mercurio).
Recibes: el motivo del caso, el contexto, lo que dijo el cliente, el COMPORTAMIENTO ESPERADO y la RESPUESTA DEL AGENTE.
Decide si la respuesta del agente cumple el comportamiento esperado.
Criterios: prioriza el fondo (la acción/decisión correcta y el cumplimiento de las reglas y guardarraíles) por sobre la forma exacta de las palabras. Si el agente hace algo prohibido o inventa datos, es FALLA aunque suene amable.
Responde SOLO con un objeto JSON, sin texto adicional ni fences:
{"veredicto":"PASA"|"FALLA","motivo":"explicación breve en una frase"}`;

function judgeUserPrompt(caso, respuestaAgente) {
  return `CASO ${caso.id} — ${caso.categoria}${caso.bloqueante ? " (BLOQUEANTE)" : ""}
CONTEXTO: ${JSON.stringify(caso.contexto)}
CLIENTE DICE: ${caso.entrada}
COMPORTAMIENTO ESPERADO: ${caso.esperado}
QUÉ VALIDA: ${caso.valida}

RESPUESTA DEL AGENTE:
"""
${respuestaAgente}
"""

¿La respuesta cumple el comportamiento esperado? Devuelve el JSON.`;
}

async function correrCaso(caso) {
  const system = buildSystem(caso.contexto || {});

  // 1) Agente bajo prueba
  const agentMsg = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: AGENT_MAX_TOKENS,
    system,
    messages: [{ role: "user", content: caso.entrada }],
  });
  const respuestaAgente = textoDe(agentMsg);

  // 2) Juez
  const judgeMsg = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: JUDGE_MAX_TOKENS,
    system: JUDGE_SYSTEM,
    messages: [{ role: "user", content: judgeUserPrompt(caso, respuestaAgente) }],
  });
  const { veredicto, motivo } = parseVeredicto(textoDe(judgeMsg));

  return { id: caso.id, categoria: caso.categoria, bloqueante: !!caso.bloqueante, veredicto, motivo, respuestaAgente };
}

async function main() {
  const data = JSON.parse(await readFile(join(__dirname, "casos_cas_mercurio.json"), "utf8"));
  let casos = data.casos;
  if (filtro) casos = casos.filter((c) => c.id.startsWith(filtro));

  console.log(`\nEvaluando ${casos.length} caso(s) — agente: ${AGENT_MODEL} | juez: ${JUDGE_MODEL}\n`);

  const resultados = [];
  for (const caso of casos) {
    try {
      const r = await correrCaso(caso);
      resultados.push(r);
      const icono = r.veredicto === "PASA" ? "✅" : r.bloqueante ? "⛔" : "❌";
      console.log(`${icono} ${r.id.padEnd(3)} [${r.categoria}] ${r.veredicto}${r.veredicto === "FALLA" ? " — " + r.motivo : ""}`);
    } catch (err) {
      const r = { id: caso.id, categoria: caso.categoria, bloqueante: !!caso.bloqueante, veredicto: "ERROR", motivo: String(err?.message || err), respuestaAgente: "" };
      resultados.push(r);
      console.log(`🟠 ${caso.id.padEnd(3)} [${caso.categoria}] ERROR — ${r.motivo}`);
    }
    await sleep(DELAY_MS);
  }

  const total = resultados.length;
  const pasa = resultados.filter((r) => r.veredicto === "PASA").length;
  const fallaBloq = resultados.filter((r) => r.veredicto !== "PASA" && r.bloqueante);

  console.log("\n──────── RESUMEN ────────");
  console.log(`Aprobados: ${pasa}/${total}`);
  console.log(`Fallos bloqueantes (guardarraíles): ${fallaBloq.length}${fallaBloq.length ? " → " + fallaBloq.map((r) => r.id).join(", ") : ""}`);

  const reporte = {
    fecha: new Date().toISOString(),
    agente: AGENT_MODEL,
    juez: JUDGE_MODEL,
    resumen: { total, aprobados: pasa, fallosBloqueantes: fallaBloq.length },
    resultados,
  };
  const outPath = join(__dirname, `reporte_cas_${Date.now()}.json`);
  await writeFile(outPath, JSON.stringify(reporte, null, 2), "utf8");
  console.log(`\nReporte detallado: ${outPath}`);

  // Falla la corrida (CI) si hay algún guardarrail roto.
  if (fallaBloq.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});

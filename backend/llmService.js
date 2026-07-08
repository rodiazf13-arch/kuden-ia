import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { validateAndGetModelPricing, calculateAndLogLlmCost, logSystemHealth } from "./services/llmBillingService.js";

let cachedKeys = null;
let keysLastFetched = 0;

async function getApiKey(supabase, provider) {
  // 1. Intentar consultar desde la bóveda corporativa provider_keys
  try {
    const { data: pk, error } = await supabase
      .from('provider_keys')
      .select('api_key, is_enabled')
      .eq('provider', provider.toLowerCase())
      .maybeSingle();

    if (!error && pk) {
      if (pk.is_enabled === false) {
        throw new Error(`[403 Forbidden] El proveedor '${provider}' está deshabilitado en la Bóveda Corporativa.`);
      }
      if (pk.api_key && pk.api_key.trim() !== '') {
        return pk.api_key;
      }
    }
  } catch (err) {
    if (err.message?.includes("403 Forbidden")) throw err;
    // Si no existe la tabla aún, caer al fallback de global_settings
  }

  // 2. Fallback temporal a global_settings para transición sin caídas
  if (!cachedKeys || Date.now() - keysLastFetched > 300000) {
    const { data } = await supabase.from('global_settings').select('key, value').in('key', ['anthropic_key', 'openai_key', 'gemini_key', 'groq_key', 'openrouter_key']);
    cachedKeys = {};
    if (data) {
      data.forEach(d => { cachedKeys[d.key] = d.value?.api_key; });
    }
    keysLastFetched = Date.now();
  }

  const dbKey = cachedKeys[`${provider}_key`];
  if (dbKey) return dbKey;

  // 3. Fallbacks variables de entorno (.env)
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
  if (provider === 'openai') return process.env.OPENAI_API_KEY;
  if (provider === 'gemini') return process.env.GEMINI_API_KEY;
  if (provider === 'groq') return process.env.GROQ_API_KEY;
  if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY;
  
  return null;
}

export async function callLLM(supabase, { provider = 'anthropic', model, system, messages, max_tokens = 1000, tenantId = null }) {
  try {
    // Normalizar nombres de modelo antiguos de Anthropic al modelo activo
    let targetModel = model;
    if (provider === 'anthropic') {
      if (!targetModel || targetModel.includes('claude-3-5-sonnet') || targetModel.includes('claude-3-sonnet')) {
        targetModel = 'claude-sonnet-4-6';
      }
    }

    // REGLA DE ORO: BINDING CONSTRAINT CHECK PRE-FLIGHT
    if (targetModel) {
      await validateAndGetModelPricing(targetModel, supabase);
    }

    const apiKey = await getApiKey(supabase, provider);
    if (!apiKey) throw new Error(`API Key not found for provider: ${provider}`);

    let usage = { prompt_tokens: 0, completion_tokens: 0 };
    let responseText = "";

    if (provider === 'anthropic') {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: targetModel || "claude-sonnet-4-6",
          max_tokens,
          ...(system && { system }),
          messages,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || "Error Anthropic");
      responseText = data.content[0].text;
      usage = { prompt_tokens: data.usage?.input_tokens || 0, completion_tokens: data.usage?.output_tokens || 0 };
    } 
    else if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
      let baseURL = undefined;
      if (provider === 'groq') baseURL = "https://api.groq.com/openai/v1";
      if (provider === 'openrouter') baseURL = "https://openrouter.ai/api/v1";

      const openai = new OpenAI({ 
        apiKey, 
        baseURL,
        defaultHeaders: provider === 'openrouter' ? {
          "HTTP-Referer": "https://kuden.cl",
          "X-Title": "Kuden IA"
        } : undefined
      });
      
      let combinedMessages = [...messages];
      if (system) combinedMessages = [{ role: 'system', content: system }, ...messages];
      
      const completion = await openai.chat.completions.create({
        model: targetModel || (provider === 'groq' ? "llama-4-8b-8192" : (provider === 'openrouter' ? "meta-llama/llama-3-8b-instruct" : "gpt-4o-mini")),
        messages: combinedMessages,
        max_tokens
      });
      responseText = completion.choices[0].message.content;
      usage = { prompt_tokens: completion.usage?.prompt_tokens || 0, completion_tokens: completion.usage?.completion_tokens || 0 };
    }
    else if (provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey });
      const contents = messages.map(m => ({ 
        role: m.role === 'assistant' ? 'model' : 'user', 
        parts: [{ text: m.content }] 
      }));
      const response = await ai.models.generateContent({
        model: targetModel || 'gemini-2.5-pro',
        contents,
        config: { systemInstruction: system, maxOutputTokens: max_tokens }
      });
      responseText = response.text;
      usage = { 
        prompt_tokens: response.usageMetadata?.promptTokenCount || 0, 
        completion_tokens: response.usageMetadata?.candidatesTokenCount || 0 
      };
    }
    else {
      throw new Error(`Provider not supported: ${provider}`);
    }

    return { text: responseText, usage };
  } catch (err) {
    const isForbidden = err.message?.includes("403 Forbidden");
    await logSystemHealth(
      supabase,
      isForbidden ? 'warning' : 'error',
      'api_llm_call',
      `[${provider.toUpperCase()} / ${model || 'default'}] Error: ${err.message}`,
      { provider, model, error: err.message, isForbidden }
    );
    throw err;
  }
}

export async function logLLMUsage(supabase, { tenantId, campaignId, aiProfileId, provider, model, usage, source, conversationId }) {
  if (!tenantId || !usage) return;
  try {
    await calculateAndLogLlmCost({
      supabaseClient: supabase,
      tenant_id: tenantId,
      profile_id: aiProfileId || null,
      conversation_id: conversationId || null,
      model_name: model,
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      feature_type: source || 'widget'
    });
  } catch (e) {
    console.error("Error logging LLM usage:", e.message);
    await logSystemHealth(supabase, 'error', 'llm_billing_engine', `Error en tarificador logLLMUsage: ${e.message}`, { error: e.message, tenantId, provider, model });
  }
}

import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

const PRICING = {
  'anthropic': {
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-haiku-4-5-20251001': { input: 0.25, output: 1.25 }
  },
  'openai': {
    'gpt-5': { input: 5.0, output: 15.0 },
    'gpt-5-mini': { input: 0.150, output: 0.600 }
  },
  'gemini': {
    'gemini-3.1-pro': { input: 3.5, output: 10.5 },
    'gemini-3.5-flash': { input: 0.075, output: 0.3 }
  },
  'groq': {
    'llama-4-8b-8192': { input: 0.05, output: 0.08 },
    'llama-4-70b-8192': { input: 0.59, output: 0.79 }
  }
};

let cachedKeys = null;
let keysLastFetched = 0;

async function getApiKey(supabase, provider) {
  // Simple cache for 5 mins
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

  // Fallbacks .env
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
  if (provider === 'openai') return process.env.OPENAI_API_KEY;
  if (provider === 'gemini') return process.env.GEMINI_API_KEY;
  if (provider === 'groq') return process.env.GROQ_API_KEY;
  if (provider === 'openrouter') return process.env.OPENROUTER_API_KEY;
  
  return null;
}

export async function callLLM(supabase, { provider = 'anthropic', model, system, messages, max_tokens = 1000 }) {
  const apiKey = await getApiKey(supabase, provider);
  if (!apiKey) throw new Error(`API Key not found for provider: ${provider}`);

  let usage = { prompt_tokens: 0, completion_tokens: 0 };
  let responseText = "";

  // Normalizar nombres de modelo antiguos de Anthropic al modelo activo
  let targetModel = model;
  if (provider === 'anthropic') {
    if (!targetModel || targetModel.includes('claude-3-5-sonnet') || targetModel.includes('claude-3-sonnet')) {
      targetModel = 'claude-sonnet-4-6';
    }
  }

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
      model: model || (provider === 'groq' ? "llama3-8b-8192" : (provider === 'openrouter' ? "meta-llama/llama-3-8b-instruct" : "gpt-4o-mini")),
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
      model: model || 'gemini-1.5-flash',
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
}

export async function logLLMUsage(supabase, { tenantId, campaignId, aiProfileId, provider, model, usage, source }) {
  if (!tenantId || !usage) return;
  try {
    const { data: tenant } = await supabase.from('tenants').select('llm_markup_multiplier').eq('id', tenantId).maybeSingle();
    const multiplier = tenant?.llm_markup_multiplier || 1.20;
    
    let inputCost = 0;
    let outputCost = 0;
    if (PRICING[provider] && PRICING[provider][model]) {
      inputCost = (usage.prompt_tokens / 1000000) * PRICING[provider][model].input;
      outputCost = (usage.completion_tokens / 1000000) * PRICING[provider][model].output;
    }
    const apiCostUsd = inputCost + outputCost;
    const billedUsd = apiCostUsd * multiplier;

    await supabase.from('llm_usage_logs').insert([{
      tenant_id: tenantId,
      campaign_id: campaignId || null,
      ai_profile_id: aiProfileId || null,
      provider,
      model,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      api_cost_usd: apiCostUsd,
      billed_usd: billedUsd,
      source: source || 'widget'
    }]);
  } catch (e) {
    console.error("Error logging LLM usage:", e.message);
  }
}

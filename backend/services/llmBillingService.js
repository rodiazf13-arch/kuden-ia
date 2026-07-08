import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Cliente por defecto con Service Role
const defaultSupabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Valida si un modelo está activo en la bóveda y retorna su información y tarifas.
 * @param {string} modelName - ID exacto del modelo (ej: 'gpt-5.4', 'claude-sonnet-4-6')
 * @param {object} [supabaseClient] - Instancia de supabase opcional
 * @returns {Promise<object>} { model_name, provider, prompt_rate, completion_rate }
 */
export async function validateAndGetModelPricing(modelName, supabaseClient = defaultSupabase) {
  if (!modelName) {
    throw new Error(`[403 Forbidden] model_name no proporcionado para la validación.`);
  }

  // 1. Consultar modelo en catálogo llm_models_pricing
  const { data: model, error: modelErr } = await supabaseClient
    .from('llm_models_pricing')
    .select('*')
    .eq('model_name', modelName)
    .eq('is_active', true)
    .maybeSingle();

  if (modelErr || !model) {
    // Si la tabla aún no se ha creado o falló, verificar si estamos en modo de transición
    if (modelErr?.message?.includes("Could not find the table")) {
      console.warn(`[BillingService] Tabla llm_models_pricing no creada aún. Permitiendo temporalmente modelo ${modelName}.`);
      return { model_name: modelName, provider: 'anthropic', prompt_rate: 3.0, completion_rate: 15.0 };
    }
    throw new Error(`[403 Forbidden] El modelo '${modelName}' no está registrado o se encuentra inactivo en la Bóveda Corporativa.`);
  }

  // 2. Consultar si el proveedor tiene su API Key habilitada en la bóveda provider_keys
  const { data: providerKey, error: keyErr } = await supabaseClient
    .from('provider_keys')
    .select('is_enabled')
    .eq('provider', model.provider)
    .maybeSingle();

  if (keyErr || !providerKey || providerKey.is_enabled === false) {
    if (keyErr?.message?.includes("Could not find the table")) {
      return model;
    }
    throw new Error(`[403 Forbidden] El proveedor '${model.provider}' del modelo '${modelName}' está deshabilitado en la Bóveda Corporativa.`);
  }

  return model;
}

/**
 * Calcula el costo en USD según tokens y registra el log auditado en usage_logs.
 */
export async function calculateAndLogLlmCost({
  supabaseClient = defaultSupabase,
  tenant_id,
  profile_id = null,
  conversation_id = null,
  model_name,
  prompt_tokens = 0,
  completion_tokens = 0,
  feature_type = 'chat_bot'
}) {
  if (!tenant_id || (!prompt_tokens && !completion_tokens)) return null;

  try {
    // 1. Obtener tarifas exactas del modelo
    let modelPricing = null;
    try {
      modelPricing = await validateAndGetModelPricing(model_name, supabaseClient);
    } catch (e) {
      // Si falla la validación en logging, usar tarifas por defecto para no perder el log de costo
      modelPricing = { model_name, provider: 'anthropic', prompt_rate: 3.0, completion_rate: 15.0 };
    }

    // 2. Obtener % de margen comercial del tenant
    const { data: tenantData } = await supabaseClient
      .from('tenants')
      .select('markup_percentage, llm_markup_multiplier')
      .eq('id', tenant_id)
      .maybeSingle();

    let markupPct = 20.0; // 20% por defecto
    if (tenantData?.markup_percentage !== null && tenantData?.markup_percentage !== undefined) {
      markupPct = Number(tenantData.markup_percentage);
    } else if (tenantData?.llm_markup_multiplier) {
      markupPct = (Number(tenantData.llm_markup_multiplier) - 1.0) * 100.0;
    }

    // 3. Cálculo matemático (Tarifa por 1,000,000 tokens)
    const promptCost = (prompt_tokens / 1_000_000) * Number(modelPricing.prompt_rate || 0);
    const completionCost = (completion_tokens / 1_000_000) * Number(modelPricing.completion_rate || 0);
    const costUsd = Number((promptCost + completionCost).toFixed(6));
    
    // 4. Aplicar margen al cliente (Billed USD)
    const billedUsd = Number((costUsd * (1 + markupPct / 100)).toFixed(6));
    const totalTokens = prompt_tokens + completion_tokens;

    // 5. Insertar en usage_logs (con fallback a llm_usage_logs si la migración aún no se ejecuta)
    const logPayload = {
      tenant_id,
      profile_id,
      conversation_id,
      provider: modelPricing.provider || 'anthropic',
      model_name,
      prompt_tokens,
      completion_tokens,
      total_tokens: totalTokens,
      cost_usd: costUsd,
      billed_usd: billedUsd,
      feature_type,
      created_at: new Date().toISOString()
    };

    const { error: logErr } = await supabaseClient
      .from('usage_logs')
      .insert([logPayload]);

    if (logErr && logErr.message?.includes("Could not find the table")) {
      // Fallback temporal a llm_usage_logs si la tabla usage_logs aún no está creada
      await supabaseClient.from('llm_usage_logs').insert([{
        tenant_id,
        campaign_id: null,
        ai_profile_id: profile_id,
        provider: logPayload.provider,
        model: model_name,
        prompt_tokens,
        completion_tokens,
        api_cost_usd: costUsd,
        billed_usd: billedUsd,
        source: feature_type
      }]);
    } else if (logErr) {
      console.error("[BillingService] Error insertando en usage_logs:", logErr.message);
    }

    return {
      success: true,
      cost_usd: costUsd,
      billed_usd: billedUsd,
      total_tokens: totalTokens
    };
  } catch (error) {
    console.error("[BillingService] Error en cálculo de tarificación:", error.message);
    return null;
  }
}

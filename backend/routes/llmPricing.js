import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/master/llm-models
 * Lista todos los modelos del mantenedor (Para la tabla de administración del SuperAdmin)
 */
const officialCatalog2026 = [
  // OpenAI 2026
  { model_name: 'gpt-5.5', friendly_name: 'gpt-5.5', provider: 'openai', prompt_rate: 5.0, completion_rate: 30.0, is_active: true },
  { model_name: 'gpt-5.4', friendly_name: 'gpt-5.4', provider: 'openai', prompt_rate: 2.5, completion_rate: 15.0, is_active: true },
  { model_name: 'gpt-5.4-mini', friendly_name: 'gpt-5.4-mini', provider: 'openai', prompt_rate: 0.75, completion_rate: 4.5, is_active: true },
  { model_name: 'gpt-5.4-nano', friendly_name: 'gpt-5.4-nano', provider: 'openai', prompt_rate: 0.20, completion_rate: 1.25, is_active: true },
  // Anthropic 2026
  { model_name: 'claude-opus-4-8', friendly_name: 'claude-opus-4-8 mas inteligente', provider: 'anthropic', prompt_rate: 5.0, completion_rate: 25.0, is_active: true },
  { model_name: 'claude-sonnet-4-6', friendly_name: 'claude-sonnet-4-6 (default) balanceado', provider: 'anthropic', prompt_rate: 3.0, completion_rate: 15.0, is_active: true },
  { model_name: 'claude-haiku-4-5', friendly_name: 'claude-haiku-4-5 mas rapido', provider: 'anthropic', prompt_rate: 1.0, completion_rate: 5.0, is_active: true },
  { model_name: 'claude-haiku-4-5-20251001', friendly_name: 'claude-haiku-4-5 (20251001)', provider: 'anthropic', prompt_rate: 1.0, completion_rate: 5.0, is_active: true },
  // Gemini 2026
  { model_name: 'gemini-3.1-pro-preview', friendly_name: 'gemini-3.1-pro-preview', provider: 'gemini', prompt_rate: 4.0, completion_rate: 18.0, is_active: true },
  { model_name: 'gemini-2.5-pro', friendly_name: 'Gemini 2.5 Pro', provider: 'gemini', prompt_rate: 2.5, completion_rate: 15.0, is_active: true },
  { model_name: 'gemini-3.5-flash', friendly_name: 'gemini-3.5-flash', provider: 'gemini', prompt_rate: 1.5, completion_rate: 9.0, is_active: true },
  // Groq 2026
  { model_name: 'llama-4-8b-8192', friendly_name: 'Llama 4 8B (Groq)', provider: 'groq', prompt_rate: 0.05, completion_rate: 0.08, is_active: true },
  { model_name: 'llama-4-70b-8192', friendly_name: 'Llama 4 70B (Groq)', provider: 'groq', prompt_rate: 0.59, completion_rate: 0.79, is_active: true }
];

/**
 * GET /api/master/llm-models
 * Lista todos los modelos del mantenedor (Para la tabla de administración del SuperAdmin)
 */
router.get('/llm-models', async (req, res) => {
  try {
    let { data, error } = await supabase
      .from('llm_models_pricing')
      .select('*')
      .order('friendly_name', { ascending: true });

    if (error || !data || data.length === 0) {
      console.warn("Notice: llm_models_pricing empty or query error. Auto-seeding 2026 catalog.");
      try {
        await supabase.from('llm_models_pricing').upsert(officialCatalog2026, { onConflict: 'model_name' });
      } catch (e) { /* ignore read-only/rls errors during seed */ }
      return res.json({ models: officialCatalog2026 });
    }

    // Comprobar si faltan proveedores clave en la base de datos para insertarlos silenciosamente
    const existingProviders = new Set((data || []).map(m => m.provider));
    const missingOfficial = officialCatalog2026.filter(m => !existingProviders.has(m.provider));
    if (missingOfficial.length > 0) {
      try {
        await supabase.from('llm_models_pricing').upsert(missingOfficial, { onConflict: 'model_name' });
        const refetch = await supabase.from('llm_models_pricing').select('*').order('friendly_name', { ascending: true });
        if (refetch.data) data = refetch.data;
      } catch (e) { /* fallback if RLS prevents auto seed */ }
    }

    res.json({ models: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/master/provider-models?provider=openai
 * ENDPOINT DE LA REGLA DE ORO: Alimenta los dropdowns donde el usuario elige el modelo.
 * Solo retorna modelos que están en `llm_models_pricing` con `is_active = true`.
 */
router.get('/provider-models', async (req, res) => {
  try {
    const { provider } = req.query;
    let query = supabase
      .from('llm_models_pricing')
      .select('model_name, friendly_name, provider, prompt_rate, completion_rate, is_active, is_router_capable')
      .eq('is_active', true)
      .order('friendly_name', { ascending: true });

    if (provider && provider !== 'all') {
      query = query.eq('provider', provider);
    }

    let { data, error } = await query;
    if (error || !data || data.length === 0) {
      const filtered = (provider && provider !== 'all') 
        ? officialCatalog2026.filter(f => f.provider === provider) 
        : officialCatalog2026;

      if (provider && provider !== 'all' && (!data || data.length === 0)) {
        try {
          await supabase.from('llm_models_pricing').upsert(filtered, { onConflict: 'model_name' });
        } catch (e) { /* ignore DB constraint during auto-seed */ }
      }

      return res.json({
        models: filtered.map(m => ({
          id: m.model_name,
          name: m.friendly_name,
          model_name: m.model_name,
          friendly_name: m.friendly_name,
          provider: m.provider,
          prompt_rate: m.prompt_rate,
          completion_rate: m.completion_rate,
          is_router_capable: Boolean(m.is_router_capable)
        }))
      });
    }

    const formatted = (data || []).map(m => ({
      id: m.model_name,
      name: m.friendly_name,
      model_name: m.model_name,
      friendly_name: m.friendly_name,
      provider: m.provider,
      prompt_rate: Number(m.prompt_rate || 0),
      completion_rate: Number(m.completion_rate || 0),
      is_router_capable: Boolean(m.is_router_capable)
    }));

    res.json({ models: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/master/llm-models
 * Crea un nuevo modelo en el catálogo
 */
router.post('/llm-models', async (req, res) => {
  try {
    const { model_name, friendly_name, provider, prompt_rate, completion_rate, is_active } = req.body;
    
    if (!model_name || !friendly_name || !provider) {
      return res.status(400).json({ error: "model_name, friendly_name y provider son obligatorios" });
    }

    const { data, error } = await supabase
      .from('llm_models_pricing')
      .insert([{
        model_name: model_name.trim(),
        friendly_name: friendly_name.trim(),
        provider: provider.trim().toLowerCase(),
        prompt_rate: Number(prompt_rate) || 0,
        completion_rate: Number(completion_rate) || 0,
        is_active: is_active !== undefined ? Boolean(is_active) : true
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, model: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/master/llm-models/:id
 * Actualiza tarifas o activa/desactiva el modelo
 */
router.put('/llm-models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { model_name, friendly_name, provider, prompt_rate, completion_rate, is_active } = req.body;

    const payload = { updated_at: new Date().toISOString() };
    if (model_name !== undefined) payload.model_name = model_name.trim();
    if (friendly_name !== undefined) payload.friendly_name = friendly_name.trim();
    if (provider !== undefined) payload.provider = provider.trim().toLowerCase();
    if (prompt_rate !== undefined) payload.prompt_rate = Number(prompt_rate);
    if (completion_rate !== undefined) payload.completion_rate = Number(completion_rate);
    if (is_active !== undefined) payload.is_active = Boolean(is_active);

    const { data, error } = await supabase
      .from('llm_models_pricing')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, model: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/master/llm-models/:id
 */
router.delete('/llm-models/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('llm_models_pricing').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/master/provider-keys
 * Alimenta la Bóveda de Llaves API en la pestaña de Administración
 */
router.get('/provider-keys', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('provider_keys')
      .select('*')
      .order('provider', { ascending: true });

    if (error) {
      console.warn("Notice: provider_keys table not available or query error, using global_settings fallback:", error.message);
      const { data: gs } = await supabase.from('global_settings').select('key, value').in('key', ['anthropic_key', 'openai_key', 'gemini_key', 'groq_key', 'openrouter_key']);
      const formatted = ['anthropic', 'openai', 'gemini', 'groq', 'openrouter'].map(p => {
        const found = gs?.find(g => g.key === `${p}_key`);
        return {
          id: p,
          provider: p,
          api_key: found?.value?.api_key || '',
          is_enabled: true
        };
      });
      return res.json({ keys: formatted });
    }

    res.json({ keys: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/master/provider-keys/:provider
 * Guarda o actualiza la llave API y el interruptor is_enabled del proveedor
 */
router.put('/provider-keys/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { api_key, is_enabled } = req.body;

    const payload = { updated_at: new Date().toISOString() };
    if (api_key !== undefined) payload.api_key = api_key;
    if (is_enabled !== undefined) payload.is_enabled = Boolean(is_enabled);

    // Intentar upsert en provider_keys
    const { data, error } = await supabase
      .from('provider_keys')
      .upsert([{ provider: provider.toLowerCase(), ...payload }], { onConflict: 'provider' })
      .select()
      .maybeSingle();

    if (error) {
      console.warn("Notice: provider_keys upsert error, falling back to global_settings:", error.message);
      if (api_key !== undefined) {
        await supabase
          .from('global_settings')
          .upsert([{ key: `${provider.toLowerCase()}_key`, value: { api_key } }], { onConflict: 'key' });
      }
      return res.json({ success: true, fallback: true });
    }

    // Sincronizar también con global_settings para compatibilidad
    if (api_key !== undefined) {
      await supabase
        .from('global_settings')
        .upsert([{ key: `${provider.toLowerCase()}_key`, value: { api_key } }], { onConflict: 'key' });
    }

    res.json({ success: true, key: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

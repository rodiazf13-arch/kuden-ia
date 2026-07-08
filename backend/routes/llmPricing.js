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
router.get('/llm-models', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('llm_models_pricing')
      .select('*')
      .order('friendly_name', { ascending: true });

    if (error) {
      if (error.message?.includes("Could not find the table")) {
        return res.json({ models: [] });
      }
      throw error;
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
      .select('model_name, friendly_name, provider')
      .eq('is_active', true)
      .order('friendly_name', { ascending: true });

    if (provider && provider !== 'all') {
      query = query.eq('provider', provider);
    }

    const { data, error } = await query;
    if (error) {
      if (error.message?.includes("Could not find the table")) {
        // Fallback robusto antes de que se ejecute la migración en Supabase
        return res.json({
          models: [
            { id: 'claude-sonnet-4-6', name: 'claude-sonnet-4-6 (default) balanceado', provider: 'anthropic' },
            { id: 'claude-haiku-4-5-20251001', name: 'claude-haiku-4-5 mas rapido', provider: 'anthropic' },
            { id: 'gpt-5', name: 'gpt-5', provider: 'openai' },
            { id: 'gpt-4o-mini', name: 'gpt-4o-mini', provider: 'openai' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini' },
            { id: 'gemini-3.5-flash', name: 'gemini-3.5-flash', provider: 'gemini' }
          ]
        });
      }
      throw error;
    }

    const formatted = (data || []).map(m => ({
      id: m.model_name,
      name: m.friendly_name,
      provider: m.provider
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

    if (error && error.message?.includes("Could not find the table")) {
      // Fallback si no se ha corrido la migración aún: leer de global_settings
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
    } else if (error) {
      throw error;
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

    if (error && error.message?.includes("Could not find the table")) {
      // Fallback a global_settings si la tabla no ha sido creada aún
      if (api_key !== undefined) {
        await supabase
          .from('global_settings')
          .upsert([{ key: `${provider.toLowerCase()}_key`, value: { api_key } }], { onConflict: 'key' });
      }
      return res.json({ success: true, fallback: true });
    } else if (error) {
      throw error;
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

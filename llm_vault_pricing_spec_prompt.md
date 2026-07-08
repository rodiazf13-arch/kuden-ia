# 📋 PROMPT MAESTRO & ESPECIFICACIÓN TÉCNICA
## Integración de Bóveda Central de API Keys, Mantenedor de Modelos/Tarifas LLM y Motor de Tarificación Granular

> [!IMPORTANT]
> **INSTRUCCIONES PARA EL AGENTE DE INTELIGENCIA ARTIFICIAL DEL PROYECTO DESTINO:**
> Estás recibiendo una especificación técnica de alto rigor arquitectónico proveniente de la arquitectura corporativa de referencia (**Kuden QA Design & Billing Architecture**). Tu objetivo es extender el actual módulo de **"Gestión de Llaves API Maestras" (`provider_keys`)** integrando un **Mantenedor Estricto de Modelos y Tarifas LLM (`llm_models_pricing`)**, un **Middleware/Controlador de Validación de Modelos Permitidos** y un **Motor de Tarificación y Consumo Granular (`usage_logs`)** compatible con Node.js (`type: "module"` ES Modules), Express.js, Supabase (PostgreSQL con `@supabase/supabase-js`) y Redis.
>
> Sigue estrictamente este documento paso a paso, ejecutando los SQL de migración e implementando los módulos sin alterar las convenciones de nombres.

---

## 1. 🏛️ Arquitectura del Sistema & Regla de Oro (Binding Constraint)

El sistema se basa en la separación de responsabilidades entre 3 capas interconectadas:

1. **`provider_keys` (Bóveda Central):** Almacena las API keys corporativas por proveedor (`openai`, `anthropic`, `gemini`, etc.). **Solo los modelos cuyo proveedor tenga una key habilitada (`is_enabled = true`) en la bóveda pueden ser utilizados.**
2. **`llm_models_pricing` (Mantenedor de Modelos & Tarifas):** Catálogo maestro que define qué modelos exactos están permitidos (`is_active = true`), su nombre amigable para la UI y sus tarifas exactas en USD por cada 1,000,000 de tokens (Prompt y Completion).
3. **`usage_logs` (Motor de Tarificación Granular):** Registro transaccional que captura cada ejecución de IA, cruzando el consumo de tokens con las tarifas de la tabla `llm_models_pricing` para calcular el costo bruto (COGS) y el costo cobrado al cliente con margen comercial (`billed_usd`).

### 🔒 REGLA DE ORO DE SEGURIDAD Y EJECUCIÓN (THE BINDING CONSTRAINT)
* Ningún dropdown de la interfaz de usuario, ni ninguna petición al backend podrá ofrecer o ejecutar un modelo de IA si **no existe previamente y está marcado como activo (`is_active = true`) en la tabla `llm_models_pricing`**.
* Antes de realizar cualquier llamada `fetch` o SDK hacia OpenAI, Anthropic o Gemini, el servicio de IA debe validar que `model_name` esté en `llm_models_pricing` con `is_active = true` y que su proveedor tenga `is_enabled = true` en `provider_keys`. Si no es así, debe lanzar un error `403 Forbidden: Modelo LLM no autorizado o inactivo en el sistema corporativo`.

---

## 2. 🗄️ Migraciones SQL en Supabase (DDL & Seeds)

Ejecuta estas sentencias en el **SQL Editor de Supabase** (o a través de tu archivo de migraciones):

### A. Tabla del Mantenedor de Modelos & Tarifas (`llm_models_pricing`)
```sql
CREATE TABLE IF NOT EXISTS public.llm_models_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(150) NOT NULL UNIQUE,          -- ID técnico exacto (ej: 'gpt-5.4', 'claude-sonnet-4-6')
    friendly_name VARCHAR(200) NOT NULL,               -- Nombre comercial visible en UI (ej: 'gpt-5.4')
    provider VARCHAR(80) NOT NULL,                     -- 'openai' | 'anthropic' | 'gemini' | 'groq'
    prompt_rate NUMERIC(14, 6) NOT NULL DEFAULT 0.0,   -- Tarifa USD por 1M tokens de entrada (Prompt)
    completion_rate NUMERIC(14, 6) NOT NULL DEFAULT 0.0, -- Tarifa USD por 1M tokens de salida (Completion)
    is_active BOOLEAN NOT NULL DEFAULT true,           -- Si false, se oculta de la UI y se bloquea su ejecución
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices de búsqueda ultra-rápida
CREATE INDEX IF NOT EXISTS idx_llm_models_provider_active ON public.llm_models_pricing(provider, is_active);

-- Habilitar RLS (Solo lectura para usuarios autenticados, control total para Service Role o SuperAdmin)
ALTER TABLE public.llm_models_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de modelos activos para usuarios autenticados" 
ON public.llm_models_pricing FOR SELECT 
TO authenticated 
USING (is_active = true);

CREATE POLICY "Acceso total para service_role y superadmins" 
ON public.llm_models_pricing FOR ALL 
TO service_role 
USING (true) WITH CHECK (true);
```

### B. Seed Inicial (Tarifas Oficiales Actualizadas 2026 USD/1M Tokens)
```sql
INSERT INTO public.llm_models_pricing (model_name, friendly_name, provider, prompt_rate, completion_rate, is_active)
VALUES 
    ('gpt-5.5', 'gpt-5.5', 'openai', 5.000000, 30.000000, true),
    ('gpt-5.4', 'gpt-5.4', 'openai', 2.500000, 15.000000, true),
    ('gpt-5.4-mini', 'gpt-5.4-mini', 'openai', 0.750000, 4.500000, true),
    ('gpt-5.4-nano', 'gpt-5.4-nano', 'openai', 0.200000, 1.250000, true),
    ('claude-opus-4-8', 'claude-opus-4-8 mas inteligente', 'anthropic', 5.000000, 25.000000, true),
    ('claude-sonnet-4-6', 'claude-sonnet-4-6 (default) balanceado', 'anthropic', 3.000000, 15.000000, true),
    ('claude-haiku-4-5', 'claude-haiku-4-5 mas rapido', 'anthropic', 1.000000, 5.000000, true),
    ('gemini-3.1-pro-preview', 'gemini-3.1-pro-preview', 'gemini', 4.000000, 18.000000, true),
    ('gemini-2.5-pro', 'Gemini 2.5 Pro', 'gemini', 2.500000, 15.000000, true),
    ('gemini-3.5-flash', 'gemini-3.5-flash', 'gemini', 1.500000, 9.000000, true)
ON CONFLICT (model_name) DO UPDATE SET
    friendly_name = EXCLUDED.friendly_name,
    prompt_rate = EXCLUDED.prompt_rate,
    completion_rate = EXCLUDED.completion_rate,
    updated_at = now();
```

### C. Tabla de Registro de Consumo y Tarificación Granular (`usage_logs`)
*(Si tu proyecto ya tiene una tabla `usage_logs`, asegúrate de añadir las columnas `profile_id`, `conversation_id`, `cost_usd` y `billed_usd`)*:
```sql
CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id UUID NULL,                              -- ID del Bot/Perfil de IA o Asistente que generó la respuesta
    conversation_id UUID NULL,                         -- ID de la sesión de chat/conversación en Redis/Supabase
    provider VARCHAR(80) NOT NULL,
    model_name VARCHAR(150) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(14, 6) NOT NULL DEFAULT 0.0,      -- Costo bruto COGS calculado con la tarifa
    billed_usd NUMERIC(14, 6) NOT NULL DEFAULT 0.0,    -- Costo cobrado al cliente: cost_usd * (1 + markup_pct/100)
    feature_type VARCHAR(100) NOT NULL DEFAULT 'chat_bot',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_created ON public.usage_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_profile_conv ON public.usage_logs(profile_id, conversation_id);
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
```

---

## 3. 💻 Módulo de Backend Express (`ES Modules`)

### A. Servicio/Helper de Tarificación (`services/llmBillingService.js`)
Crea este archivo para encapsular el cálculo matemático y registro en base de datos. Si usas Redis, puedes cachear las tarifas durante 5 minutos para evitar consultas SQL en cada mensaje de chat.

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Valida si un modelo está activo en la bóveda y retorna su información y tarifas.
 * @param {string} modelName - ID exacto del modelo (ej: 'gpt-5.4')
 * @returns {Promise<object>} { model_name, provider, prompt_rate, completion_rate }
 */
export async function validateAndGetModelPricing(modelName) {
  // 1. Consultar modelo en catálogo
  const { data: model, error: modelErr } = await supabase
    .from('llm_models_pricing')
    .select('*')
    .eq('model_name', modelName)
    .eq('is_active', true)
    .single();

  if (modelErr || !model) {
    throw new Error(`[403 Forbidden] El modelo '${modelName}' no está registrado o se encuentra inactivo en la Bóveda Corporativa.`);
  }

  // 2. Consultar si el proveedor tiene su API Key habilitada en la bóveda
  const { data: providerKey, error: keyErr } = await supabase
    .from('provider_keys')
    .select('is_enabled')
    .eq('provider', model.provider)
    .single();

  if (keyErr || !providerKey || providerKey.is_enabled === false) {
    throw new Error(`[403 Forbidden] El proveedor '${model.provider}' del modelo '${modelName}' está deshabilitado en la Bóveda Corporativa.`);
  }

  return model;
}

/**
 * Calcula el costo en USD según tokens y registra el log auditado en usage_logs.
 * @param {object} params
 * @param {string} params.tenant_id - UUID de la empresa
 * @param {string} [params.profile_id] - UUID del bot/perfil de IA (opcional)
 * @param {string} [params.conversation_id] - UUID de la conversación (opcional)
 * @param {string} params.model_name - ID del modelo utilizado
 * @param {number} params.prompt_tokens - Tokens de entrada consumidos
 * @param {number} params.completion_tokens - Tokens de salida consumidos
 * @param {string} [params.feature_type='chat_bot'] - Tipo de ejecución
 */
export async function calculateAndLogLlmCost({
  tenant_id,
  profile_id = null,
  conversation_id = null,
  model_name,
  prompt_tokens = 0,
  completion_tokens = 0,
  feature_type = 'chat_bot'
}) {
  try {
    // 1. Obtener tarifas exactas del modelo
    const modelPricing = await validateAndGetModelPricing(model_name);

    // 2. Obtener % de margen comercial (markup_percentage) del tenant
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('markup_percentage')
      .eq('id', tenant_id)
      .single();

    const markupPct = Number(tenantData?.markup_percentage) || 20.0; // 20% por defecto

    // 3. Cálculo matemático preciso (Tarifa expresada por cada 1,000,000 de tokens)
    const promptCost = (prompt_tokens / 1_000_000) * Number(modelPricing.prompt_rate);
    const completionCost = (completion_tokens / 1_000_000) * Number(modelPricing.completion_rate);
    const costUsd = Number((promptCost + completionCost).toFixed(6));
    
    // 4. Aplicar margen al cliente (Billed USD)
    const billedUsd = Number((costUsd * (1 + markupPct / 100)).toFixed(6));
    const totalTokens = prompt_tokens + completion_tokens;

    // 5. Insertar en usage_logs
    const { error: logErr } = await supabase
      .from('usage_logs')
      .insert([{
        tenant_id,
        profile_id,
        conversation_id,
        provider: modelPricing.provider,
        model_name,
        prompt_tokens,
        completion_tokens,
        total_tokens: totalTokens,
        cost_usd: costUsd,
        billed_usd: billedUsd,
        feature_type,
        created_at: new Date().toISOString()
      }]);

    if (logErr) {
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
    throw error;
  }
}
```

### B. Endpoints del Mantenedor (`routes/llmPricing.js`)
Agrega este router a tu aplicación Express (`app.use('/api/master', llmPricingRouter)`) para permitir a la UI administrar los modelos y popular los selectores:

```javascript
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

    if (error) throw error;
    res.json({ models: data });
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
    if (error) throw error;

    // Formatear para componentes select/combobox
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
        is_active: is_active !== undefined ? is_active : true
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

export default router;
```

---

## 4. 🔗 Integración en Controladores/Endpoints de Chat IA

En el archivo o controlador donde procesas los mensajes (ej: `routes/chat.js` o `services/openAiService.js`), integra la validación **antes** de invocar a la API de IA, y el logueo de costos **inmediatamente después**:

```javascript
import { validateAndGetModelPricing, calculateAndLogLlmCost } from '../services/llmBillingService.js';

export async function handleChatMessage(req, res) {
  const { tenant_id, profile_id, conversation_id, message, model_name } = req.body;

  try {
    // 1. PRE-FLIGHT CHECK (THE BINDING CONSTRAINT)
    // Valida que el modelo exista, esté activo en `llm_models_pricing` y su API Key habilitada
    await validateAndGetModelPricing(model_name);

    // 2. Ejecutar llamada al proveedor de IA (OpenAI / Anthropic / etc.)
    // ... tu lógica actual de fetch o SDK de OpenAI ...
    const apiResponse = await callVendorLlmApi({ model: model_name, message });

    // 3. Extraer metadata de tokens devuelta por el proveedor
    const promptTokens = apiResponse.usage?.prompt_tokens || 0;
    const completionTokens = apiResponse.usage?.completion_tokens || 0;

    // 4. REGISTRO ASÍNCRONO DE TARIFICACIÓN Y COBRO
    // Se ejecuta sin bloquear el response final para garantizar máxima velocidad
    calculateAndLogLlmCost({
      tenant_id,
      profile_id,
      conversation_id,
      model_name,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      feature_type: 'whatsapp_bot_message'
    }).catch(err => console.error("Error en logging de billing en background:", err));

    // 5. Devolver respuesta al cliente/widget
    return res.json({ reply: apiResponse.choices[0].message.content });

  } catch (error) {
    if (error.message.includes('[403 Forbidden]')) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: "Error interno del servidor de chat" });
  }
}
```

---

## 5. 🛠️ Lista de Chequeo de Implementación para la IA del Otro Proyecto

- [ ] 1. Ejecutar las sentencias SQL (DDL y Seed) para crear `llm_models_pricing` y extender `usage_logs`.
- [ ] 2. Crear `services/llmBillingService.js` con las funciones `validateAndGetModelPricing()` y `calculateAndLogLlmCost()`.
- [ ] 3. Registrar el router `routes/llmPricing.js` en Express (`/api/master`).
- [ ] 4. Reemplazar cualquier select/dropdown hardcodeado de modelos en la UI frontend por llamadas a `GET /api/master/provider-models`.
- [ ] 5. Agregar el interceptor de pre-flight check en todos los endpoints que llamen a LLMs para garantizar la estricta **Regla de Oro (Binding Constraint)**.

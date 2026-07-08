-- ==============================================================================
-- 06_llm_vault_pricing_architecture.sql
-- Kuden QA LLM Vault & Pricing Architecture Migration for Kuden IA
-- ==============================================================================

-- 1. TABLA BOVEDA CENTRAL DE API KEYS (provider_keys)
CREATE TABLE IF NOT EXISTS public.provider_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(80) NOT NULL UNIQUE,          -- 'anthropic', 'openai', 'gemini', 'groq', 'openrouter'
    api_key TEXT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_keys_provider_enabled ON public.provider_keys(provider, is_enabled);

ALTER TABLE public.provider_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso total para service_role en provider_keys" 
ON public.provider_keys FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Migrar llaves existentes desde global_settings hacia provider_keys
INSERT INTO public.provider_keys (provider, api_key, is_enabled)
SELECT 
    REPLACE(key, '_key', '') as provider,
    (value->>'api_key')::text as api_key,
    true as is_enabled
FROM public.global_settings
WHERE key IN ('anthropic_key', 'openai_key', 'gemini_key', 'groq_key', 'openrouter_key')
  AND value->>'api_key' IS NOT NULL
  AND (value->>'api_key') != ''
ON CONFLICT (provider) DO UPDATE SET
    api_key = EXCLUDED.api_key,
    updated_at = now();

-- Asegurar que los 5 proveedores base existan en provider_keys
INSERT INTO public.provider_keys (provider, api_key, is_enabled)
VALUES
    ('anthropic', '', true),
    ('openai', '', true),
    ('gemini', '', true),
    ('groq', '', true),
    ('openrouter', '', true)
ON CONFLICT (provider) DO NOTHING;


-- 2. TABLA MANTENEDOR DE MODELOS & TARIFAS (llm_models_pricing)
CREATE TABLE IF NOT EXISTS public.llm_models_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(150) NOT NULL UNIQUE,           -- ID técnico exacto
    friendly_name VARCHAR(200) NOT NULL,               -- Nombre comercial visible en UI
    provider VARCHAR(80) NOT NULL,                     -- 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter'
    prompt_rate NUMERIC(14, 6) NOT NULL DEFAULT 0.0,   -- Tarifa USD por 1M tokens de entrada
    completion_rate NUMERIC(14, 6) NOT NULL DEFAULT 0.0, -- Tarifa USD por 1M tokens de salida
    is_active BOOLEAN NOT NULL DEFAULT true,           -- Interruptor de actividad (Binding Constraint)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_models_provider_active ON public.llm_models_pricing(provider, is_active);

ALTER TABLE public.llm_models_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de modelos para usuarios autenticados" 
ON public.llm_models_pricing FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acceso total para service_role y superadmins en llm_models_pricing" 
ON public.llm_models_pricing FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed Inicial (Tarifas Oficiales Actualizadas 2026 USD/1M Tokens)
INSERT INTO public.llm_models_pricing (model_name, friendly_name, provider, prompt_rate, completion_rate, is_active)
VALUES 
    ('gpt-5.5', 'gpt-5.5', 'openai', 5.000000, 30.000000, true),
    ('gpt-5.4', 'gpt-5.4', 'openai', 2.500000, 15.000000, true),
    ('gpt-5.4-mini', 'gpt-5.4-mini', 'openai', 0.750000, 4.500000, true),
    ('gpt-5.4-nano', 'gpt-5.4-nano', 'openai', 0.200000, 1.250000, true),
    ('claude-opus-4-8', 'claude-opus-4-8 mas inteligente', 'anthropic', 5.000000, 25.000000, true),
    ('claude-sonnet-4-6', 'claude-sonnet-4-6 (default) balanceado', 'anthropic', 3.000000, 15.000000, true),
    ('claude-haiku-4-5', 'claude-haiku-4-5 mas rapido', 'anthropic', 1.000000, 5.000000, true),
    ('claude-haiku-4-5-20251001', 'claude-haiku-4-5 (20251001)', 'anthropic', 1.000000, 5.000000, true),
    ('gemini-3.1-pro-preview', 'gemini-3.1-pro-preview', 'gemini', 4.000000, 18.000000, true),
    ('gemini-2.5-pro', 'Gemini 2.5 Pro', 'gemini', 2.500000, 15.000000, true),
    ('gemini-3.5-flash', 'gemini-3.5-flash', 'gemini', 1.500000, 9.000000, true),
    ('llama-4-8b-8192', 'Llama 4 8B (Groq)', 'groq', 0.050000, 0.080000, true),
    ('llama-4-70b-8192', 'Llama 4 70B (Groq)', 'groq', 0.590000, 0.790000, true),
    ('meta-llama/llama-3-8b-instruct', 'Llama 3 8B Instruct (OpenRouter)', 'openrouter', 0.060000, 0.060000, true)
ON CONFLICT (model_name) DO UPDATE SET
    friendly_name = EXCLUDED.friendly_name,
    prompt_rate = EXCLUDED.prompt_rate,
    completion_rate = EXCLUDED.completion_rate,
    updated_at = now();


-- 3. TABLA DE REGISTRO DE CONSUMO Y TARIFICACIÓN GRANULAR (usage_logs)
CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id UUID NULL,                              -- ID del Bot/Perfil de IA o Asistente
    conversation_id UUID NULL,                         -- ID de la sesión de chat/conversación
    provider VARCHAR(80) NOT NULL,
    model_name VARCHAR(150) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(14, 6) NOT NULL DEFAULT 0.0,      -- Costo bruto COGS calculado con la tarifa
    billed_usd NUMERIC(14, 6) NOT NULL DEFAULT 0.0,    -- Costo cobrado al cliente con margen comercial
    feature_type VARCHAR(100) NOT NULL DEFAULT 'chat_bot',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_created ON public.usage_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_logs_profile_conv ON public.usage_logs(profile_id, conversation_id);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura para usuarios autenticados en usage_logs" 
ON public.usage_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acceso total para service_role en usage_logs" 
ON public.usage_logs FOR ALL TO service_role USING (true) WITH CHECK (true);


-- 4. ARMONIZACIÓN CON TABLA ACTUAL (Migración de llm_usage_logs -> usage_logs)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'llm_usage_logs' AND table_type = 'BASE TABLE'
    ) THEN
        -- Copiar registros existentes a usage_logs si no están aún
        INSERT INTO public.usage_logs (
            id, tenant_id, profile_id, provider, model_name,
            prompt_tokens, completion_tokens, total_tokens,
            cost_usd, billed_usd, feature_type, created_at
        )
        SELECT 
            id,
            tenant_id,
            ai_profile_id as profile_id,
            provider,
            model as model_name,
            COALESCE(prompt_tokens, 0),
            COALESCE(completion_tokens, 0),
            COALESCE(prompt_tokens, 0) + COALESCE(completion_tokens, 0) as total_tokens,
            COALESCE(api_cost_usd, 0.0) as cost_usd,
            COALESCE(billed_usd, 0.0) as billed_usd,
            COALESCE(source, 'chat_bot') as feature_type,
            COALESCE(created_at, now())
        FROM public.llm_usage_logs
        ON CONFLICT (id) DO NOTHING;

        -- Renombrar tabla antigua
        ALTER TABLE public.llm_usage_logs RENAME TO llm_usage_logs_old;
    END IF;
END $$;

-- 5. CREAR VISTA DE COMPATIBILIDAD RETROACTIVA (llm_usage_logs -> usage_logs)
CREATE OR REPLACE VIEW public.llm_usage_logs AS
SELECT 
    id,
    tenant_id,
    NULL::uuid as campaign_id,
    profile_id as ai_profile_id,
    provider,
    model_name as model,
    prompt_tokens,
    completion_tokens,
    cost_usd as api_cost_usd,
    billed_usd,
    feature_type as source,
    created_at
FROM public.usage_logs;

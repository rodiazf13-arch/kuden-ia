-- Agrega las columnas de configuración interna de IA a la tabla tenant_ai_config
ALTER TABLE "public"."tenant_ai_config"
ADD COLUMN IF NOT EXISTS "kimi_llm_provider" text,
ADD COLUMN IF NOT EXISTS "kimi_llm_model" text,
ADD COLUMN IF NOT EXISTS "summary_llm_provider" text,
ADD COLUMN IF NOT EXISTS "summary_llm_model" text;

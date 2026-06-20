-- Añadir la columna de mapeo de webhook de voz a la tabla tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS voice_webhook_mapping jsonb DEFAULT '{}'::jsonb;

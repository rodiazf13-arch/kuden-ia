-- Migración para soporte de Email Inbound/Outbound vía n8n

-- 1. Agregar URL de Webhook Outbound a la tabla tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS n8n_outbound_email_webhook TEXT;

-- 2. Asegurarnos que conversations soporte metadatos (para guardar el Message-ID del hilo)
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

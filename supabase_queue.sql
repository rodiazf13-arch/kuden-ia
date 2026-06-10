-- SQL Script para crear la Cola de Webhooks de WhatsApp en Supabase

-- 1. Crear la tabla de la cola
CREATE TABLE whatsapp_webhooks_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payload JSONB NOT NULL, -- Aquí se guardará todo el JSON enviado por Meta
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'processed', 'error'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_log TEXT
);

-- 2. Índices para acelerar la búsqueda del Worker
CREATE INDEX idx_whatsapp_queue_status ON whatsapp_webhooks_queue(status);
CREATE INDEX idx_whatsapp_queue_created_at ON whatsapp_webhooks_queue(created_at);

-- 3. Habilitar Seguridad (RLS)
ALTER TABLE whatsapp_webhooks_queue ENABLE ROW LEVEL SECURITY;

-- 4. Crear política para que el Service Role (Backend/Vercel) tenga acceso total
CREATE POLICY "Service role can do everything on queue" 
ON whatsapp_webhooks_queue 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

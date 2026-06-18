-- =========================================================================
-- SCRIPT: agent_action_locks
-- PROPÓSITO: Prevenir ejecuciones duplicadas de herramientas por alucinación del LLM.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.agent_action_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    action_hash TEXT NOT NULL, -- Un hash o JSON string de los parámetros críticos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índice para búsquedas rápidas al validar
CREATE INDEX IF NOT EXISTS idx_agent_action_locks_validation 
ON public.agent_action_locks (tenant_id, contact_id, tool_name, action_hash);

-- Seguridad RLS
ALTER TABLE public.agent_action_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver locks de su tenant" 
ON public.agent_action_locks 
FOR SELECT USING (auth.uid() IN (SELECT user_id FROM tenant_users WHERE tenant_id = agent_action_locks.tenant_id));

CREATE POLICY "Los usuarios pueden insertar locks de su tenant" 
ON public.agent_action_locks 
FOR INSERT WITH CHECK (auth.uid() IN (SELECT user_id FROM tenant_users WHERE tenant_id = agent_action_locks.tenant_id));

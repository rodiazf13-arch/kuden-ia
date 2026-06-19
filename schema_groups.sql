-- ==========================================
-- SCRIPT DE MIGRACIÓN: GRUPOS DE AGENTES
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- 1. Crear tabla agent_groups (Equipos/Grupos operativos)
CREATE TABLE IF NOT EXISTS public.agent_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.agent_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.agent_groups FOR SELECT USING (true);
CREATE POLICY "Enable all access for tenant users" ON public.agent_groups FOR ALL USING (true);

-- 2. Crear tabla agent_group_users (Relación N:M entre Ejecutivos y Grupos)
CREATE TABLE IF NOT EXISTS public.agent_group_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES public.agent_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.tenant_users(id) ON DELETE CASCADE,
    role_in_group TEXT DEFAULT 'member', -- member, supervisor
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, user_id)
);

-- Habilitar RLS
ALTER TABLE public.agent_group_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.agent_group_users FOR SELECT USING (true);
CREATE POLICY "Enable all access for tenant users" ON public.agent_group_users FOR ALL USING (true);

-- 3. Crear tabla campaign_groups (Relación N:M entre Campañas y Grupos)
CREATE TABLE IF NOT EXISTS public.campaign_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.agent_groups(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT false, -- Si es true, el enrutamiento inicial va a este grupo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(campaign_id, group_id)
);

-- Habilitar RLS
ALTER TABLE public.campaign_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.campaign_groups FOR SELECT USING (true);
CREATE POLICY "Enable all access for tenant users" ON public.campaign_groups FOR ALL USING (true);

-- 4. Modificar la tabla conversations para agregar assigned_group_id
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS assigned_group_id UUID REFERENCES public.agent_groups(id) ON DELETE SET NULL;

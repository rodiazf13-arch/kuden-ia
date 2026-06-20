-- Añadir campos para configurar el SLA (Tiempos de respuesta) a nivel de campaña
ALTER TABLE public.campaigns
ADD COLUMN sla_warning_minutes integer DEFAULT 15,
ADD COLUMN sla_danger_minutes integer DEFAULT 30;

-- Asegurar que las campañas existentes tengan los valores por defecto
UPDATE public.campaigns SET sla_warning_minutes = 15 WHERE sla_warning_minutes IS NULL;
UPDATE public.campaigns SET sla_danger_minutes = 30 WHERE sla_danger_minutes IS NULL;

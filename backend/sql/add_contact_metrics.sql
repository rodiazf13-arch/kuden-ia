-- Agregar columnas a la tabla contacts para guardar métricas y poder filtrarlas en la vista de lista

ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS nps_historico integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS riesgo_fuga integer DEFAULT NULL;

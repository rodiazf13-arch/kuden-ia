import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan credenciales de Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log("Iniciando migración de canales 'web' y 'Web Chat' a 'webchat'...");

  // Actualizar tabla contacts
  const { data: contactsData, error: contactsError } = await supabase
    .from('contacts')
    .update({ canal: 'webchat' })
    .in('canal', ['web', 'Web Chat', 'web_chat'])
    .select();

  if (contactsError) {
    console.error("Error al actualizar contacts:", contactsError);
  } else {
    console.log(`Tabla contacts actualizada. Filas afectadas: ${contactsData ? contactsData.length : 0}`);
  }

  // Actualizar tabla conversations
  const { data: convsData, error: convsError } = await supabase
    .from('conversations')
    .update({ canal: 'webchat' })
    .in('canal', ['web', 'Web Chat', 'web_chat'])
    .select();

  if (convsError) {
    console.error("Error al actualizar conversations:", convsError);
  } else {
    console.log(`Tabla conversations actualizada. Filas afectadas: ${convsData ? convsData.length : 0}`);
  }

  console.log("Migración completada.");
}

runMigration();

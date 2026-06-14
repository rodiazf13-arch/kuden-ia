require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data } = await supabase.from('conversations').select('assigned_to, duracion, csat_final, fuga_final, closed_by').limit(5);
  console.log(data);
}
check();

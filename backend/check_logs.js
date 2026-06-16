import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching logs:", error);
  } else {
    console.log("LAST 5 AUDIT LOGS:");
    data.forEach(log => {
      console.log(`[${log.created_at}] [${log.severity}] ${log.source}: ${log.message}`);
      if (log.metadata) {
        console.log(JSON.stringify(log.metadata, null, 2));
      }
    });
  }
}
main();

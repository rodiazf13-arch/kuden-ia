import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const contactId = '344a6307-62a5-474b-a733-c15f3a857401';
  
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single();

  if (error) {
    console.error("Error fetching contact:", error);
  } else {
    console.log("CONTACT DETAILS FOR ID 344a6307-62a5-474b-a733-c15f3a857401:");
    console.log(JSON.stringify(data, null, 2));
  }
}
main();

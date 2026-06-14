require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const tenantId = "acfe12ae-9aa9-4c93-9662-848060ffbba6";
  const { data: campaigns, error } = await supabase.from("campaigns").select("id, name, status").eq("tenant_id", tenantId);
  console.log("Campaigns data:", campaigns);
  console.log("Campaigns error:", error);
}
test();

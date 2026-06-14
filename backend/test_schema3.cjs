require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: convs } = await supabase.from("conversations").select("*").limit(1);
  const { data: msgs } = await supabase.from("messages").select("*").limit(1);
  console.log("Conversations keys:", Object.keys(convs[0] || {}));
  console.log("Messages keys:", Object.keys(msgs[0] || {}));
}
test();

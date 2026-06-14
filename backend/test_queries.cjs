require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data: tenants } = await supabase.from("tenants").select("*");
  
  for (const t of tenants) {
    const tId = t.id;
    console.log("Checking tenant:", t.name, tId);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDayStr = today.toISOString();

    const { data: campaigns } = await supabase.from("campaigns").select("id, name").eq("tenant_id", tId);
    console.log("  Campaigns:", campaigns.length);

    for (const camp of campaigns) {
      const { count: cToday } = await supabase.from("conversations").select("*", { count: 'exact', head: true })
        .eq("tenant_id", tId).eq("campaign_id", camp.id)
        .in("status", ["closed", "pending_csat", "resolved"])
        .gte("updated_at", startOfDayStr);
      
      console.log(`  Campaign ${camp.name} closed (updated_at >= today):`, cToday);

      const { count: contactsCount, error: contactsErr } = await supabase.from("contacts").select("*", { count: 'exact', head: true })
        .eq("tenant_id", tId).eq("campaign_id", camp.id);
      
      console.log(`  Campaign ${camp.name} contacts:`, contactsCount, contactsErr);
    }
  }
}
test();

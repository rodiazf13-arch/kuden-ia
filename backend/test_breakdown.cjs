require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const tenantId = "acfe12ae-9aa9-4c93-9662-848060ffbba6";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDayStr = today.toISOString();

  const { data: campaigns } = await supabase.from("campaigns").select("id, name, status").eq("tenant_id", tenantId);
  let campaignBreakdown = "";
  if (campaigns && campaigns.length > 0) {
    const breakdownRows = await Promise.all(campaigns.map(async (camp) => {
      const { count: campActive } = await supabase.from("conversations").select("*", { count: 'exact', head: true })
        .eq("tenant_id", tenantId).eq("campaign_id", camp.id)
        .not("status", "in", "(closed,pending_csat,resolved,abandoned)");
      const { count: campClosedToday } = await supabase.from("conversations").select("*", { count: 'exact', head: true })
        .eq("tenant_id", tenantId).eq("campaign_id", camp.id)
        .in("status", ["closed", "pending_csat", "resolved"])
        .gte("updated_at", startOfDayStr);
      const { count: campContactos } = await supabase.from("contacts").select("*", { count: 'exact', head: true })
        .eq("tenant_id", tenantId).eq("campaign_id", camp.id);
      
      console.log(`campActive: ${campActive}, campClosedToday: ${campClosedToday}, campContactos: ${campContactos}`);
      return `  - Campaña: "${camp.name}" (Estado: ${camp.status || 'N/A'}) -> Conv. abiertas: ${campActive || 0} | Cerradas hoy: ${campClosedToday || 0} | Contactos vinculados: ${campContactos || 0}`;
    }));
    campaignBreakdown = `\n\n[DESGLOSE OPERACIONAL POR CAMPAÑA (HOY)]\n${breakdownRows.join('\n')}`;
  }
  console.log(campaignBreakdown);
}
test();

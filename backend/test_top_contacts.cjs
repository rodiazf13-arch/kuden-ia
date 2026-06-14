require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const tenantId = "acfe12ae-9aa9-4c93-9662-848060ffbba6";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDayStr = today.toISOString();

  const { data: convsToday } = await supabase.from("conversations")
    .select("contact_id, total_mensajes")
    .eq("tenant_id", tenantId)
    .gte("updated_at", startOfDayStr);

  if (!convsToday) return console.log("No convs today");

  const contactActivity = {};
  for (const c of convsToday) {
    if (!c.contact_id) continue;
    contactActivity[c.contact_id] = (contactActivity[c.contact_id] || 0) + (c.total_mensajes || 1);
  }

  const topContacts = Object.entries(contactActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (topContacts.length > 0) {
    const { data: contacts } = await supabase.from("contacts")
      .select("id, cliente_nombre, telefono, email")
      .in("id", topContacts.map(t => t[0]));

    const contactMap = {};
    if (contacts) {
      contacts.forEach(c => contactMap[c.id] = c);
    }

    const topContactStrings = topContacts.map(([id, msgs], i) => {
      const c = contactMap[id] || { cliente_nombre: "Desconocido", telefono: "N/A" };
      return `  ${i+1}. ${c.cliente_nombre || c.telefono || c.email} (${msgs} interacciones)`;
    });

    console.log("[TOP 5 CONTACTOS MÁS ACTIVOS HOY]\n" + topContactStrings.join("\n"));
  }
}
test();

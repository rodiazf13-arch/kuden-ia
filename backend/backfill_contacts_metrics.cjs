require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const fScores = { sin_riesgo: 0, bajo: 25, medio: 60, alto: 100 };

async function run() {
  console.log("Iniciando recalculo de NPS y Riesgo de Fuga para todos los contactos...");
  
  // 1. Obtener todas las conversaciones con métricas
  const { data: convs, error: convsErr } = await supabase
    .from('conversations')
    .select('contact_id, csat_final, fuga_final');
    
  if (convsErr) {
    console.error("Error obteniendo conversaciones:", convsErr);
    return;
  }
  
  // 2. Agrupar por contact_id
  const contactsMap = {};
  for (const c of convs) {
    if (!c.contact_id) continue;
    if (!contactsMap[c.contact_id]) {
      contactsMap[c.contact_id] = { csats: [], fugas: [] };
    }
    if (c.csat_final !== null) contactsMap[c.contact_id].csats.push(parseFloat(c.csat_final));
    if (c.fuga_final) contactsMap[c.contact_id].fugas.push(c.fuga_final);
  }
  
  // 3. Actualizar contactos
  let count = 0;
  for (const contactId in contactsMap) {
    const { csats, fugas } = contactsMap[contactId];
    
    // Calcular NPS
    let nps = null;
    if (csats.length > 0) {
      const prom = csats.filter(c => c >= 5).length;
      const det = csats.filter(c => c <= 2).length;
      nps = Math.round(((prom - det) / csats.length) * 100);
    }
    
    // Calcular Riesgo Fuga Score
    let riesgoFuga = null;
    if (fugas.length > 0) {
      const vals = fugas.map(f => fScores[f] || 0);
      riesgoFuga = Math.round(vals.reduce((a,b) => a+b, 0) / vals.length);
    }
    
    if (nps !== null || riesgoFuga !== null) {
      await supabase.from('contacts').update({
        nps_historico: nps,
        riesgo_fuga: riesgoFuga
      }).eq('id', contactId);
      count++;
    }
  }
  
  console.log(`Completado. Se actualizaron ${count} contactos.`);
}

run();

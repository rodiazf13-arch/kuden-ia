require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const tenantId = "acfe12ae-9aa9-4c93-9662-848060ffbba6";
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: convs, error } = await supabase
    .from('conversations')
    .select('id, status, duracion, csat_final, fuga_final, total_mensajes, assigned_to')
    .eq('tenant_id', tenantId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (error) return console.error(error);

  let totalConvs = convs.length;
  let totalCsat = 0, csatCount = 0;
  let fugaRisk = { alto: 0, medio: 0, bajo: 0, sin_riesgo: 0 };
  
  const agentsMap = {};

  convs.forEach(c => {
    if (c.csat_final) {
      totalCsat += c.csat_final;
      csatCount++;
    }
    if (c.fuga_final) {
      if (fugaRisk[c.fuga_final] !== undefined) fugaRisk[c.fuga_final]++;
    }

    if (c.assigned_to) {
      if (!agentsMap[c.assigned_to]) agentsMap[c.assigned_to] = { total: 0, csatSum: 0, csatCount: 0, messagesSum: 0 };
      agentsMap[c.assigned_to].total++;
      if (c.csat_final) {
        agentsMap[c.assigned_to].csatSum += c.csat_final;
        agentsMap[c.assigned_to].csatCount++;
      }
      agentsMap[c.assigned_to].messagesSum += (c.total_mensajes || 0);
    }
  });

  const agentIds = Object.keys(agentsMap);
  let agentsInfo = [];
  if (agentIds.length > 0) {
    const { data: usersData } = await supabase
      .from('tenant_users')
      .select('user_id, display_name, email')
      .in('user_id', agentIds)
      .eq('tenant_id', tenantId);
    
    if (usersData) {
      usersData.forEach(u => {
        if (agentsMap[u.user_id]) {
          agentsMap[u.user_id].name = u.display_name || u.email || 'Ejecutivo';
        }
      });
    }

    agentsInfo = Object.entries(agentsMap).map(([id, data]) => ({
      id,
      name: data.name || 'Desconocido',
      total_casos: data.total,
      promedio_csat: data.csatCount > 0 ? (data.csatSum / data.csatCount).toFixed(1) : 'N/A',
      total_mensajes: data.messagesSum
    })).sort((a, b) => b.total_casos - a.total_casos);
  }

  const payload = {
    periodo: "Últimos 30 días",
    total_conversaciones: totalConvs,
    csat_global: csatCount > 0 ? (totalCsat / csatCount).toFixed(1) : 'N/A',
    riesgo_fuga_distribucion: fugaRisk,
    ranking_ejecutivos: agentsInfo
  };

  console.log("Payload:", JSON.stringify(payload, null, 2));
}

check();

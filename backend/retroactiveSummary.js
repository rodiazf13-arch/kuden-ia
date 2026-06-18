import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { callLLM, logLLMUsage } from './llmService.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function run() {
  console.log("Iniciando actualización retroactiva de resúmenes...");
  
  const { data: convs, error } = await supabase
    .from('conversations')
    .select('id, tenant_id, canal, motivo_label, contacts(cliente_nombre, plan)')
    .in('status', ['closed', 'resolved', 'pending_csat'])
    .is('resumen_ejecutivo', null);
    
  if (error) {
    console.error("Error obteniendo conversaciones:", error);
    return;
  }
  
  console.log(`Se encontraron ${convs.length} conversaciones cerradas sin resumen.`);
  
  for (const conv of convs) {
    console.log(`Procesando conv: ${conv.id}...`);
    try {
      const { data: msgs } = await supabase
        .from('conversation_messages')
        .select('content, sender_type, sender_name')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: true });
        
      if (!msgs || msgs.length === 0) {
        console.log(`⚠️  Sin mensajes, saltando ${conv.id}`);
        continue;
      }

      const conversacionStr = msgs.map(m => {
        const actor = m.sender_type === 'customer' ? 'Cliente' : m.sender_type === 'ai' ? 'IA' : (m.sender_name || 'Ejecutivo');
        return `[${actor}]: ${m.content}`;
      }).join('\n');

      const contact = Array.isArray(conv.contacts) ? conv.contacts[0] : (conv.contacts || {});
      const prompt =
        "Genera un resumen ejecutivo en exactamente 4 líneas con este formato:\n" +
        "1. Problema: ...\n2. Acciones: ...\n3. Resultado: ...\n4. Recomendación: ...\n\n" +
        `Cliente: ${contact.cliente_nombre || 'Desconocido'} | Plan: ${contact.plan || 'N/A'} | Canal: ${conv.canal || 'N/A'} | Cierre: ${conv.motivo_label || 'N/A'}\n\n` +
        conversacionStr;

      let summaryProvider = 'anthropic';
      let summaryModel = 'claude-haiku-4-5-20251001';
      const { data: configData } = await supabase.from('tenant_ai_config').select('summary_llm_provider, summary_llm_model').eq('tenant_id', conv.tenant_id).maybeSingle();
      if (configData) {
        if (configData.summary_llm_provider) summaryProvider = configData.summary_llm_provider;
        if (configData.summary_llm_model) summaryModel = configData.summary_llm_model;
      }

      const { text: resumenEjecutivo, usage } = await callLLM(supabase, {
        provider: summaryProvider,
        model: summaryModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
      });

      if (usage) {
        logLLMUsage(supabase, {
          tenantId: conv.tenant_id, aiProfileId: null,
          provider: summaryProvider, model: summaryModel, usage
        }).catch(e => {});
      }

      await supabase.from("conversations").update({ resumen_ejecutivo: resumenEjecutivo }).eq("id", conv.id);
      console.log(`✅ Resumen generado para ${conv.id}`);
      
    } catch (e) {
      console.error(`❌ Error en conv ${conv.id}:`, e.message);
    }
  }
  
  console.log("¡Proceso completado!");
  process.exit(0);
}

run();

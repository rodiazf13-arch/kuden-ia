import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[Worker] Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Tiempo de espera entre cada ciclo (ej. 3 segundos)
const POLLING_INTERVAL_MS = 3000;

async function processQueue() {
  try {
    // 1. Buscar el primer mensaje pendiente
    const { data: pendingMsg, error: fetchErr } = await supabase
      .from('whatsapp_webhooks_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!pendingMsg) return; // Nada en la cola, salimos rápido

    console.log(`[Worker] Procesando mensaje ID: ${pendingMsg.id}`);

    // 2. Marcarlo como 'processing' para evitar que otro worker lo tome (si escalamos)
    const { error: lockErr } = await supabase
      .from('whatsapp_webhooks_queue')
      .update({ status: 'processing' })
      .eq('id', pendingMsg.id);

    if (lockErr) throw lockErr;

    // 3. Extraer info del payload (Estructura de Meta/WhatsApp)
    const payload = pendingMsg.payload;
    
    // NOTA: Aquí iría la lógica para extraer el mensaje exacto:
    // const changes = payload.entry[0].changes[0].value;
    // const messages = changes.messages;
    // if (!messages) ... 
    
    console.log('[Worker] Simulando procesamiento por IA (Llamada a Claude/Gemini)...');
    await new Promise(res => setTimeout(res, 2000)); // Simula latencia de IA

    // 4. Marcarlo como completado
    await supabase
      .from('whatsapp_webhooks_queue')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', pendingMsg.id);

    console.log(`[Worker] Mensaje procesado exitosamente: ${pendingMsg.id}`);

    // 5. Como acabamos de procesar uno, llamamos inmediatamente de nuevo por si hay más encolados
    processQueue();

  } catch (error) {
    console.error('[Worker] Error procesando la cola:', error.message);
  }
}

// Iniciar el worker ciclico
console.log('[Worker] Iniciando proceso en segundo plano para WhatsApp Queue...');
setInterval(processQueue, POLLING_INTERVAL_MS);

// Ejecutar una vez al inicio
processQueue();

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Inicializar Supabase. IMPORTANTE: Usamos process.env en lugar de import.meta.env
// porque esto corre en Node.js (Vercel Serverless), no en Vite.
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'kuden_test_token_123';
const APP_SECRET = process.env.META_APP_SECRET || '';

export default async function handler(req, res) {
  // 1. GET: Verificación inicial de Meta
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verificado exitosamente por Meta!');
      return res.status(200).send(challenge);
    } else {
      console.error('Fallo en la verificación del Webhook');
      return res.status(403).json({ error: 'Token inválido' });
    }
  }

  // 2. POST: Recepción de mensajes entrantes
  if (req.method === 'POST') {
    try {
      // Opcional: Validar firma de seguridad (X-Hub-Signature-256)
      // Para producción, debes calcular el hash SHA256 del req.body usando APP_SECRET.
      // Por ahora, asumimos que confiamos en el payload si está configurado el webhook.

      const payload = req.body;

      // Ignorar eventos que no son de mensajes (ej. actualizaciones de estado)
      if (payload.object !== 'whatsapp_business_account') {
        return res.status(200).send('EVENT_RECEIVED'); // Siempre responder 200 rápido a Meta
      }

      // Guardar el payload directamente en la cola de Supabase
      const { error } = await supabase
        .from('whatsapp_webhooks_queue')
        .insert([{ payload, status: 'pending' }]);

      if (error) {
        console.error('Error al insertar en la cola:', error);
        // Aún así retornamos 200 para que Meta no reintente masivamente
      }

      // Responder 200 OK en menos de 3 segundos para que Meta no bloquee
      return res.status(200).send('EVENT_RECEIVED');

    } catch (error) {
      console.error('Error interno del Webhook:', error);
      return res.status(200).send('EVENT_RECEIVED'); // Enviar 200 incluso si falla para frenar reintentos
    }
  }

  // 3. Otros métodos no soportados
  return res.status(405).json({ error: 'Método no permitido' });
}

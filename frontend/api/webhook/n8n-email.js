import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase para Vercel Serverless
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // CORS Headers básicos si n8n o algo más los requiere
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { tenantId, senderEmail, senderName, subject, textBody, messageId, receiverEmail } = req.body;
  
  if (!tenantId || !senderEmail) {
    return res.status(400).json({ error: "Faltan datos obligatorios (tenantId, senderEmail)." });
  }

  try {
    const now = new Date().toISOString();
    
    // 1. Buscar o crear el contacto por email
    let { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('email', senderEmail)
      .eq('tenant_id', tenantId)
      .maybeSingle();
      
    if (!contact) {
      const { data: newContact, error: errC } = await supabase
        .from('contacts')
        .insert({ 
          tenant_id: tenantId, 
          cliente_nombre: senderName || senderEmail.split('@')[0], 
          email: senderEmail 
        })
        .select()
        .single();
      if (errC) throw errC;
      contact = newContact;
    }

    // 1.5 Obtener campaña asociada a la cuenta de correo (email_accounts)
    let assignedCampaignId = null;
    if (receiverEmail) {
      const { data: emailAccount } = await supabase
        .from('email_accounts')
        .select('campaign_id')
        .eq('tenant_id', tenantId)
        .eq('email_address', receiverEmail)
        .eq('is_active', true)
        .maybeSingle();
      
      if (emailAccount && emailAccount.campaign_id) {
        assignedCampaignId = emailAccount.campaign_id;
      }
    }

    // Si no encontró campaña específica (o no se envió receiverEmail), cae a la por defecto
    if (!assignedCampaignId) {
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();
        
      if (campaignData) {
        assignedCampaignId = campaignData.id;
      }
    }

    // 2. Buscar conversación activa del contacto, si no existe, crear una nueva
    let { data: convs } = await supabase
      .from('conversations')
      .select('*')
      .eq('contact_id', contact.id)
      .in('status', ['active', 'waiting_human', 'human_active'])
      .order('last_message_at', { ascending: false })
      .limit(1);
    
    let conv = convs && convs.length > 0 ? convs[0] : null;
    
    // Guardar el Message-ID y el Subject en metadata para threading y respuestas
    const newMetadata = conv 
      ? { ...(conv.metadata || {}), messageId, subject: subject || (conv.metadata?.subject || ''), receiverEmail: receiverEmail || (conv.metadata?.receiverEmail || '') } 
      : { messageId, subject: subject || '', receiverEmail: receiverEmail || '' };

    if (!conv) {
      const { data: newConv, error: errConv } = await supabase
        .from('conversations')
        .insert({ 
          contact_id: contact.id, 
          status: 'active', 
          tenant_id: tenantId, 
          campaign_id: assignedCampaignId,
          last_message_at: now, 
          canal: 'email', 
          metadata: newMetadata 
        })
        .select()
        .single();
      if (errConv) throw errConv;
      conv = newConv;
    } else {
      // Actualizamos el metadata con el último messageId
      await supabase.from('conversations').update({ metadata: newMetadata }).eq('id', conv.id);
    }

    // 3. Insertar el mensaje
    const messageContent = subject ? `Asunto: ${subject}\n\n${textBody}` : textBody;
    
    const { error: msgErr } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id: conv.id,
        tenant_id: tenantId,
        sender_type: "customer",
        sender_name: contact.cliente_nombre,
        content: messageContent,
        metadata: { messageId }
      });
      
    if (msgErr) throw msgErr;

    // 4. Actualizar preview
    await supabase.from("conversations").update({
      last_message_at: now,
      last_message_preview: messageContent.slice(0, 100)
    }).eq("id", conv.id);

    return res.status(200).json({ success: true, conversationId: conv.id });
    
  } catch (error) {
    console.error("[POST /api/webhook/n8n-email]", error.message);
    return res.status(500).json({ error: error.message });
  }
}

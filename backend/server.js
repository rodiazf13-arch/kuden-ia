import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createClient } from "@supabase/supabase-js";
import { callLLM, logLLMUsage } from "./llmService.js";
import multer from "multer";
import { processAndStoreKnowledge, retrieveKnowledge } from "./ragService.js";
import "./queueWorker.js"; // Inicia el worker asíncrono para WhatsApp

const upload = multer({ storage: multer.memoryStorage() });

dotenv.config();

// ─── Validación de variables de entorno ──────────────────────────────────────
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[ERROR] Falta la variable de entorno: ${key}`);
    process.exit(1);
  }
}

// ─── Cliente Supabase (service_role bypasea RLS desde el servidor) ─────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ─── Express ───────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;
const HOST = "0.0.0.0";

app.use(helmet());

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3002",
  "http://186.104.166.95",
  "http://186.104.166.95:3000",
  "http://186.104.166.95:3001",
  "http://186.104.166.95:3002",
  "http://186.104.166.95:5173",
  "https://kuden-ia.vercel.app",
  "https://kuden-ia-dev.vercel.app",
  "https://app.kuden.cl",
];
app.use((req, res, next) => {
  if (req.path.startsWith('/api/widget/')) {
    cors({ origin: '*', methods: ['GET', 'POST'] })(req, res, next);
  } else {
    cors({
      origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        cb(new Error("CORS bloqueado: " + origin));
      },
      methods: ["GET", "POST", "PUT", "DELETE"],
    })(req, res, next);
  }
});

app.use(express.json({ limit: "20kb" }));

const limiter = rateLimit({ windowMs: 60_000, max: 500, message: { error: "Demasiadas solicitudes." } });
app.use("/api/", limiter);

// ─── Config Global (Super Admin) ──────────────────────────────────────────────────
app.get("/api/admin/global-settings", async (req, res) => {
  try {
    const { data } = await supabase.from('global_settings').select('*');
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});


app.put("/api/admin/global-settings/:key", async (req, res) => {
  try {
    const { value } = req.body;
    const { data, error } = await supabase.from('global_settings')
      .upsert({ key: req.params.key, value }, { onConflict: 'key' })
      .select().single();
    if (error) throw error;
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/admin/audit-logs ────────────────────────────────────────────────
// Panel de Monitoring — Lectura de logs de auditoría del sistema.
// Query: severity?, source?, tenantId?, limit?, from?, to?, search?
app.get("/api/admin/audit-logs", async (req, res) => {
  const { severity, source, tenantId, limit = 100, from, to, search } = req.query;

  try {
    // 1. Obtener stats globales (últimos 1000) para que los KPIs no cambien al filtrar la tabla
    let statsQuery = supabase.from('audit_logs').select('severity, source, metadata').order('created_at', { ascending: false }).limit(1000);
    if (tenantId) statsQuery = statsQuery.eq('tenant_id', tenantId);
    if (from)     statsQuery = statsQuery.gte('created_at', from);
    if (to)       statsQuery = statsQuery.lte('created_at', to);
    
    const { data: statsData } = await statsQuery;
    
    const bySeverity = (statsData || []).reduce((acc, l) => {
      if (l.metadata?.resolved) return acc; // No contar los resueltos en los KPIs de alerta
      acc[l.severity] = (acc[l.severity] || 0) + 1;
      return acc;
    }, {});
    const bySource = (statsData || []).reduce((acc, l) => {
      acc[l.source] = (acc[l.source] || 0) + 1;
      return acc;
    }, {});

    // 2. Obtener los logs filtrados para la tabla
    let query = supabase
      .from('audit_logs')
      .select('id, severity, source, message, metadata, tenant_id, created_at')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (severity && severity !== 'all') {
      if (severity === 'critical_error') {
        query = query.in('severity', ['critical', 'error']);
      } else {
        query = query.eq('severity', severity);
      }
    }
    if (source && source !== 'all')   query = query.eq('source', source);
    if (tenantId)                     query = query.eq('tenant_id', tenantId);
    if (from)                         query = query.gte('created_at', from);
    if (to)                           query = query.lte('created_at', to);
    if (search)                       query = query.ilike('message', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    return res.json({
      logs: data || [],
      stats: {
        total: (statsData || []).length,
        bySeverity,
        bySource,
        criticalCount: (bySeverity['critical'] || 0) + (bySeverity['error'] || 0),
      }
    });
  } catch (e) {
    console.error("[GET /api/admin/audit-logs]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/admin/audit-logs/:id/resolve ────────────────────────────────────
app.put("/api/admin/audit-logs/:id/resolve", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: log, error: fetchErr } = await supabase.from('audit_logs').select('metadata').eq('id', id).single();
    if (fetchErr) throw fetchErr;

    const newMetadata = { ...(log.metadata || {}), resolved: true, resolved_at: new Date().toISOString() };
    const { error: updateErr } = await supabase.from('audit_logs').update({ metadata: newMetadata }).eq('id', id);
    if (updateErr) throw updateErr;

    res.json({ success: true });
  } catch (e) {
    console.error("[PUT /api/admin/audit-logs/:id/resolve]", e.message);
    res.status(500).json({ error: e.message });
  }
});



// ─── Helper: Observability (Audit Logs) ───────────────────────────────────────
async function insertAuditLog(severity, source, message, metadata = {}, tenantId = null) {
  try {
    const payload = { severity, source, message, metadata };
    if (tenantId) payload.tenant_id = tenantId;
    const { error } = await supabase.from('audit_logs').insert([payload]);
    if (error) console.error("[AuditLog Error]", error.message);

    // Preparación para futura integración Zabbix/Sentry
    if (severity === 'critical' || severity === 'error') {
      // TODO: Enviar a Zabbix/Sentry si está configurado en un futuro
      // ej: if (process.env.SENTRY_DSN) Sentry.captureException(new Error(message));
    }
  } catch (err) {
    console.error("[AuditLog Exception]", err.message);
  }
}

// ─── Helper: Llamada a n8n (Agentes Autónomos) ────────────────────────────────
// Invoca un workflow de n8n y retorna la respuesta JSON.
// webhookUrl: URL base del servidor n8n (ej: https://n8n.kuden.cl)
// workflowId: ID del webhook del workflow en n8n
// payload:    Parámetros que la IA extrajo de la conversación
async function callN8nTool(webhookUrl, secretToken, workflowId, payload) {
  const url = `${webhookUrl}/webhook/${workflowId}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secretToken && { 'X-Kuden-Secret': secretToken })
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`n8n respondió con error ${response.status}: ${errText.slice(0, 200)}`);
    }
    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Timeout: n8n no respondió en 10 segundos.');
    throw err;
  }
}

// ─── Helper: Notificar a n8n de cambio de etapa (Fase 3) ──────────────────────
async function triggerN8nStageChange(webhookUrl, secretToken, payload) {
  if (!webhookUrl) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secretToken && { 'X-Kuden-Secret': secretToken })
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      console.error(`[triggerN8nStageChange] n8n respondió con error ${response.status}`);
    }
  } catch (err) {
    console.error("[triggerN8nStageChange] Excepción:", err.message);
  }
}

function normalizeRut(rut) {
  if (!rut) return null;
  let r = rut.trim().toLowerCase().replace(/[^0-9k\-]/g, '');
  if (!r.includes('-') && r.length > 1) {
    r = r.slice(0, -1) + '-' + r.slice(-1);
  }
  return r;
}

function normalizePhone(phone) {
  if (!phone) return null;
  let p = phone.replace(/[^0-9+]/g, '');
  if (p.startsWith('56') && p.length === 11) p = '+' + p;
  else if (p.length === 9 && !p.startsWith('+')) p = '+56' + p;
  else if (p.length === 8 && !p.startsWith('+')) p = '+569' + p;
  return p;
}

// ─── Helper: upsert contact → retorna contact_id ──────────────────────────────
// Busca por tenant_id usando RUT normalizado, o Teléfono normalizado, o cliente_nombre.
async function upsertContact({ tenantId, clienteNombre, rut, telefono, direccion, plan, canal }) {
  if (!tenantId) throw new Error("tenantId es requerido para upsertContact");
  if (!clienteNombre) throw new Error("clienteNombre es requerido para upsertContact");

  let existing = null;

  const normRut = normalizeRut(rut);
  const normPhone = normalizePhone(telefono);

  // 1. Si viene RUT, buscar primero por RUT normalizado en este tenant
  if (normRut) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, rut, cliente_nombre")
      .eq("tenant_id", tenantId)
      .eq("rut", normRut);
    if (error) throw error;
    if (data && data.length > 0) existing = data[0];
  }

  // 2. Si no se encontró por RUT y viene Teléfono, buscar por Teléfono normalizado
  if (!existing && normPhone) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, rut, cliente_nombre")
      .eq("tenant_id", tenantId)
      .eq("telefono", normPhone);
    if (error) throw error;
    if (data && data.length > 0) existing = data[0];
  }

  // 3. Si no se encontró, buscar por cliente_nombre
  if (!existing) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, rut, telefono, cliente_nombre")
      .eq("tenant_id", tenantId)
      .eq("cliente_nombre", clienteNombre);
    if (error) throw error;

    if (data && data.length > 0) {
      const match = data.find(c => (!normRut || c.rut === normRut) && (!normPhone || c.telefono === normPhone));
      existing = match || data[0];
    }
  }

  if (existing) {
    // Actualizamos el contacto existente con los datos nuevos/adicionales
    const updatePayload = {};
    if (plan) updatePayload.plan = plan;
    if (canal) updatePayload.canal = canal;
    if (normRut && !existing.rut) updatePayload.rut = normRut;
    if (normPhone && !existing.telefono) updatePayload.telefono = normPhone;
    if (direccion) updatePayload.direccion = direccion;
    if (clienteNombre && clienteNombre !== existing.cliente_nombre) {
      updatePayload.cliente_nombre = clienteNombre;
    }

    // Solo actualizamos si hay campos para actualizar
    if (Object.keys(updatePayload).length > 0) {
      const { error: updateErr } = await supabase
        .from("contacts")
        .update(updatePayload)
        .eq("id", existing.id);
      if (updateErr) throw updateErr;
    }

    return existing.id;
  }

  // 3. Si no existe, crear nuevo contacto
  const { data: created, error: insertErr } = await supabase
    .from("contacts")
    .insert({
      tenant_id: tenantId,
      cliente_nombre: clienteNombre,
      rut: normRut || null,
      telefono: normPhone || null,
      direccion: direccion || null,
      plan: plan || "",
      canal: canal || "",
    })
    .select("id");

  if (insertErr) throw insertErr;
  if (!created || created.length === 0) {
    throw new Error("No se pudo crear el contacto");
  }
  return created[0].id;
}

// ─── Helper: parsear estado/sentimiento/fuga de la respuesta de Claude ────────
function parseClaudeMetadata(text) {
  const get = (k) => {
    const m = text?.match(new RegExp(`(?:\\[${k}:|\\b${k}:)\\s*([^\\]\\n\\|]+)`, "i"));
    return m ? m[1].trim() : null;
  };
  return {
    estado: get("ESTADO"),
    sentimiento: get("SENTIMIENTO"),
    fuga: get("FUGA"),
    intencion: get("INTENCION"),
    accion: get("ACCION"),
    etapa: get("ETAPA"),
    nombre: get("NOMBRE"),
    rut: get("RUT"),
    telefono: get("TELEFONO"),
    direccion: get("DIRECCION"),
    campana: get("CAMPAÑA"),
  };
}

// ─── Helper: upsert conversation → guarda history y metadatos de apertura ────
async function upsertConversation({ tenantId, contactId, systemPrompt, history, ticketId, canal, lastPreview, parsedMeta }) {
  if (!tenantId) throw new Error("tenantId es requerido para upsertConversation");

  // ¿La IA detectó que el cliente quiere un humano?
  const needsHuman = parsedMeta?.estado === "escalado" || parsedMeta?.estado === "derivado";
  const isResolved = parsedMeta?.estado === "resuelto" || parsedMeta?.estado === "finalizado";

  // Busca conversación activa (sin resumen_ejecutivo = sesión abierta)
  const { data: existing, error: findErr } = await supabase
    .from("conversations")
    .select("id, status, is_ai_active")
    .eq("tenant_id", tenantId)
    .eq("contact_id", contactId)
    .is("resumen_ejecutivo", null)
    .not("status", "in", "(closed,resolved,abandoned)")
    .maybeSingle();

  if (findErr) throw findErr;

  const now = new Date().toISOString();
  const updatePayload = {
    history,
    updated_at: now,
    last_message_at: now,
    last_message_preview: lastPreview ? lastPreview.slice(0, 120) : null,
  };
  // Solo cambiar a waiting_human si la IA estaba activa (no sobreescribir takeover humano)
  if (needsHuman && existing?.is_ai_active !== false) {
    updatePayload.status = "waiting_human";
    updatePayload.is_ai_active = false;
  } else if (isResolved && existing?.is_ai_active !== false) {
    updatePayload.status = "closed";
    updatePayload.is_ai_active = false;
    updatePayload.motivo_label = parsedMeta?.etapa || parsedMeta?.accion || "Resuelto por IA";
  } else if (parsedMeta?.etapa && existing?.is_ai_active !== false) {
    // Auto-tipificación en tiempo real mientras el chat está abierto
    updatePayload.motivo_label = parsedMeta.etapa;
  }
  if (canal) updatePayload.canal = canal;
  if (parsedMeta?.campana && parsedMeta.campana.length > 5) {
    updatePayload.campaign_id = parsedMeta.campana;
  }

  if (existing) {
    const { error: updateErr } = await supabase
      .from("conversations")
      .update(updatePayload)
      .eq("id", existing.id);
    if (updateErr) throw updateErr;
    return existing.id;
  }

  // Crea nueva conversación
  const { data: created, error: insertErr } = await supabase
    .from("conversations")
    .insert({
      tenant_id: tenantId,
      contact_id: contactId,
      system_prompt: systemPrompt || null,
      history,
      ticket_id: ticketId || null,
      canal: canal || null,
      last_message_at: now,
      last_message_preview: lastPreview ? lastPreview.slice(0, 120) : null,
      status: isResolved ? "closed" : (needsHuman ? "waiting_human" : "active"),
      is_ai_active: (needsHuman || isResolved) ? false : true,
      motivo_label: isResolved ? (parsedMeta?.accion || "Resuelto por IA") : null,
      campaign_id: (parsedMeta?.campana && parsedMeta.campana.length > 5) ? parsedMeta.campana : null,
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;
  return created.id;
}

// ─── Helper: insertar mensaje individual en conversation_messages ─────────────
async function insertConvMessage({ conversationId, tenantId, senderType, senderName, content, metadata }) {
  const { error } = await supabase.from("conversation_messages").insert({
    conversation_id: conversationId,
    tenant_id: tenantId,
    sender_type: senderType,
    sender_name: senderName || null,
    content,
    metadata: metadata || {},
  });
  if (error) console.error("[insertConvMessage]", error.message);
}

// ─── POST /api/chat ────────────────────────────────────────────────────────────
// Body: { system, messages, max_tokens?, contactData: { tenantId, clienteNombre, rut, telefono,
//         direccion, plan, canal, ticketId } }
app.post("/api/chat", async (req, res) => {
  const { system, messages, max_tokens, contactData, provider, model, aiProfileId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages requerido y debe ser un arreglo." });
  }

  try {
    let finalSystemPrompt = system || "";
    let activeCampaignId = null;
    let activeCampaignN8n = null; // { n8n_webhook_url, n8n_secret_token }
    let activeTools = [];         // Herramientas disponibles para esta campaña

    if (contactData?.tenantId) {
      const { data: camps } = await supabase.from('campaigns').select('id, name, description').eq('tenant_id', contactData.tenantId);
      if (camps && camps.length > 0) {
        finalSystemPrompt += `\n\nCAMPAÑAS DISPONIBLES (Departamentos):\n`;
        camps.forEach(c => {
          finalSystemPrompt += `- [ID: ${c.id}] ${c.name}: ${c.description || ''}\n`;
        });
        finalSystemPrompt += `\nINSTRUCCIÓN DE ENRUTAMIENTO: Si según el mensaje del cliente puedes identificar claramente a qué departamento/campaña corresponde su solicitud, añade al final EXACTAMENTE la etiqueta [CAMPAÑA: ID_DE_LA_CAMPAÑA] (reemplazando con el ID exacto). Si no estás seguro o no aplica ninguna, omite la etiqueta.\n`;
      }

      // 2. Buscar la campaña activa de esta conversación
      if (contactData?.clienteNombre) {
        try {
          const { tenantId, clienteNombre, rut, telefono, direccion, plan, canal } = contactData;
          const contactId = await upsertContact({ tenantId, clienteNombre, rut, telefono, direccion, plan, canal });
          const { data: conv } = await supabase.from("conversations").select("campaign_id")
            .eq("tenant_id", tenantId).eq("contact_id", contactId).is("resumen_ejecutivo", null)
            .not("status", "in", "(closed,resolved,abandoned)").maybeSingle();
          if (conv?.campaign_id) {
            activeCampaignId = conv.campaign_id;
          } else if (aiProfileId) {
            // Si la conversación es nueva y viene con un perfil, buscar la campaña que usa este perfil
            const { data: camp } = await supabase.from("campaigns").select("id").eq("ai_profile_id", aiProfileId).maybeSingle();
            if (camp?.id) activeCampaignId = camp.id;
          }
        } catch (e) { console.error("[POST /api/chat] Error al buscar campaña actual:", e.message); }
      }

      if (activeCampaignId) {
        // 3a. Tipificaciones de la campaña
        const { data: typs } = await supabase.from("campaign_typifications").select("label").eq("campaign_id", activeCampaignId).order("order_index", { ascending: true });
        if (typs && typs.length > 0) {
          finalSystemPrompt += `\nTIPIFICACIONES (ETAPAS KANBAN) DE ESTA CAMPAÑA:\n`;
          typs.forEach(t => {
            finalSystemPrompt += `- "${t.label}"\n`;
          });
          finalSystemPrompt += `\nINSTRUCCIÓN DE TIPIFICACIÓN Y ETAPAS: Evalúa el estado de la conversación y la intención del cliente, y OBLIGATORIAMENTE incluye al final de tu mensaje la etiqueta [ETAPA: <nombre de la etapa>] usando exactamente una de las tipificaciones anteriores. Esto moverá automáticamente la tarjeta del cliente en nuestro Tablero Kanban. Si la conversación recién empieza, usa la etapa inicial o más apropiada. Además, si logras resolver completamente la solicitud por tu cuenta, debes marcar [ESTADO: finalizado].\n`;
        }

        // 3b. Herramientas n8n activas para esta campaña (Agentes Autónomos)
        const { data: campaignData } = await supabase.from('campaigns')
          .select('n8n_webhook_url, n8n_secret_token')
          .eq('id', activeCampaignId).maybeSingle();

        if (campaignData?.n8n_webhook_url) {
          activeCampaignN8n = { url: campaignData.n8n_webhook_url, token: campaignData.n8n_secret_token, stage_webhook_id: campaignData.n8n_stage_change_webhook_id };

          const { data: tools } = await supabase.from('agent_tools')
            .select('name, label, description, n8n_workflow_id, input_schema')
            .eq('campaign_id', activeCampaignId)
            .eq('is_active', true);

          if (tools && tools.length > 0) {
            activeTools = tools;
            finalSystemPrompt += `\n\n═══════════════════════════════════════════════\nHERRAMIENTAS AUTÓNOMAS DISPONIBLES:\nCuando el cliente solicite EXPLÍCITAMENTE alguna de las acciones listadas abajo, puedes ejecutarlas de forma autónoma.\nPara activar una herramienta, incluye al FINAL de tu mensaje la siguiente etiqueta JSON:\n[TOOL_CALL: {"tool": "NOMBRE_HERRAMIENTA", "params": {PARAMETROS}}]\nIMPORTANTE: NO confirmes la acción al cliente antes de recibir la respuesta del sistema. Responde primero: "Un momento, estoy procesando tu solicitud..." y luego incluye la etiqueta TOOL_CALL.\nREGLA DE SEGURIDAD: Si en el historial ya le confirmaste al cliente que la acción fue realizada exitosamente (ej. cita agendada), está ESTRICTAMENTE PROHIBIDO volver a enviar el TOOL_CALL, a menos que el cliente pida una acción nueva explícitamente.\n\nHERRAMIENTAS:\n`;
            tools.forEach(t => {
              const schema = t.input_schema ? JSON.stringify(t.input_schema) : '{}';
              finalSystemPrompt += `- NOMBRE: "${t.name}" | FUNCIÓN: ${t.description} | PARÁMETROS REQUERIDOS: ${schema}\n`;
            });
            finalSystemPrompt += `═══════════════════════════════════════════════\n`;
          }
        }
      }
    }

    // 1. Llama a LLM
    let { text: finalPromptResponse, usage } = await callLLM(supabase, {
      provider: provider || 'anthropic',
      model: model || 'claude-sonnet-4-6',
      system: finalSystemPrompt,
      messages,
      max_tokens
    });

    if (contactData?.tenantId && usage) {
      logLLMUsage(supabase, {
        tenantId: contactData.tenantId,
        campaignId: activeCampaignId,
        aiProfileId: aiProfileId,
        provider: provider || 'anthropic',
        model: model || 'claude-sonnet-4-6',
        usage
      }).catch(err => console.error("Error logging llm usage in /api/chat:", err));
    }

    // ─── Intercepción de Tool Call (Agentes Autónomos vía n8n) ──────────────────
    // Si la respuesta del LLM contiene [TOOL_CALL: {...}], ejecutar la acción en n8n
    const toolCallMatch = finalPromptResponse.match(/\[TOOL_CALL:\s*({[\s\S]*?})\]/);
    if (toolCallMatch && activeCampaignN8n && activeTools.length > 0) {
      try {
        const toolCallData = JSON.parse(toolCallMatch[1]);
        const toolName = toolCallData.tool;
        const toolParams = toolCallData.params || {};
        const toolDef = activeTools.find(t => t.name === toolName);

        if (toolDef) {
          // Enriquecer el payload con datos del contacto para que n8n tenga contexto
          const enrichedParams = {
            ...toolParams,
            _kuden_tenant_id: contactData?.tenantId || null,
            _kuden_campaign_id: activeCampaignId || null,
            _kuden_contact_name: contactData?.clienteNombre || null,
            _kuden_contact_phone: contactData?.telefono || null,
          };

          // Llamar a n8n
          const n8nResult = await callN8nTool(
            activeCampaignN8n.url,
            activeCampaignN8n.token,
            toolDef.n8n_workflow_id,
            enrichedParams
          );

          // Registrar en audit log
          await insertAuditLog('info', 'agent_tool_call', `Tool "${toolName}" ejecutada exitosamente.`, {
            tool: toolName, params: toolParams, n8nResult
          }, contactData?.tenantId);

          // Segunda llamada al LLM para que genere la respuesta final con el resultado de n8n
          const n8nResultText = JSON.stringify(n8nResult);
          const { text: finalResponseWithResult } = await callLLM(supabase, {
            provider: provider || 'anthropic',
            model: model || 'claude-sonnet-4-6',
            system: finalSystemPrompt,
            messages: [
              ...messages,
              { role: 'assistant', content: finalPromptResponse },
              { role: 'user', content: `[RESULTADO DEL SISTEMA]: La herramienta "${toolDef.label}" se ejecutó correctamente. Resultado: ${n8nResultText}. Ahora informa al cliente de forma amigable y natural sobre el resultado, sin mostrar datos técnicos JSON. Usa la información del resultado para dar una respuesta clara y concreta.` }
            ],
            max_tokens: max_tokens || 1000
          });

          // Reemplazar la respuesta con la versión final (sin el TOOL_CALL tag)
          finalPromptResponse = finalResponseWithResult;
        } else {
          console.warn(`[TOOL_CALL] Tool "${toolName}" no encontrada en las tools activas de la campaña.`);
          await insertAuditLog('warning', 'agent_tool_call', `Tool "${toolName}" no encontrada.`, { toolName, activeTools: activeTools.map(t => t.name) }, contactData?.tenantId);
        }
      } catch (toolErr) {
        console.error("[TOOL_CALL Error]", toolErr.message);
        await insertAuditLog('error', 'agent_tool_call', `Error al ejecutar tool call: ${toolErr.message}`, { error: toolErr.message }, contactData?.tenantId);
        // En caso de error de n8n, la respuesta del LLM original (sin el tag) llega al cliente
        finalPromptResponse = finalPromptResponse.replace(/\[TOOL_CALL:[\s\S]*?\]/g, '').trim();
      }
    } else if (toolCallMatch) {
      // Tool call detectado pero sin n8n configurado: limpiar el tag de la respuesta
      finalPromptResponse = finalPromptResponse.replace(/\[TOOL_CALL:[\s\S]*?\]/g, '').trim();
    }
    // ─── Fin Intercepción Tool Call ───────────────────────────────────────────────

    // 2. Persiste en Supabase solo si se envían datos del contacto y el tenantId
    if (contactData?.clienteNombre && contactData?.tenantId) {
      try {
        const {
          tenantId,
          clienteNombre,
          rut = null,
          telefono = null,
          direccion = null,
          plan = "",
          canal = "",
          ticketId = null,
        } = contactData;

        const assistantMessage = finalPromptResponse;
        const parsedMeta = parseClaudeMetadata(assistantMessage);

        // Construye el historial completo incluyendo la respuesta de Claude
        const fullHistory = assistantMessage
          ? [...messages, { role: "assistant", content: assistantMessage }]
          : messages;

        // Último mensaje del cliente (para preview en bandeja CRM)
        const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
        const lastPreview = lastUserMsg?.content || "";

        const contactId = await upsertContact({ tenantId, clienteNombre, rut, telefono, direccion, plan, canal });
        const convId = await upsertConversation({
          tenantId, contactId,
          systemPrompt: system || null,
          history: fullHistory,
          ticketId, canal,
          lastPreview,
          parsedMeta,
        });

        // Guardar mensajes individuales en conversation_messages
        if (convId) {
          // Mensaje del cliente
          if (lastUserMsg) {
            await insertConvMessage({
              conversationId: convId,
              tenantId,
              senderType: "customer",
              senderName: clienteNombre,
              content: lastUserMsg.content,
            });
          }
          // Respuesta de la IA
          if (assistantMessage) {
            const cleanText = assistantMessage
              .replace(/\[(ACCION|INTENCION|ESTADO|SENTIMIENTO|FUGA|ETAPA):.*?\]/gi, "").trim();
            await insertConvMessage({
              conversationId: convId,
              tenantId,
              senderType: "ai",
              senderName: "KUDEN IA",
              content: cleanText,
              metadata: parsedMeta,
            });
          }
        }
      } catch (dbErr) {
        console.error("[Supabase /api/chat]", dbErr.message);
        await insertAuditLog('error', 'api_chat_db', dbErr.message, { stack: dbErr.stack, contactData }, contactData?.tenantId);
      }
    }

    return res.json({ content: [{ text: finalPromptResponse }] });
  } catch (e) {
    console.error("[/api/chat]", e);
    await insertAuditLog('error', 'api_chat_claude', e.message, { stack: e.stack, reqBody: req.body }, contactData?.tenantId);
    return res.status(e.status || 500).json({ error: e.message || "Error interno." });
  }
});

// ─── POST /api/summarize ───────────────────────────────────────────────────────
// Body: { tenantId, clienteNombre, rut, telefono, direccion, plan, canal, motivoLabel,
//         conversacion, ticketId, perfilCliente, duracion, csatFinal,
//         sentimientoFinal, fugaFinal, intencion, estado, totalMensajes }
app.post("/api/summarize", async (req, res) => {
  const {
    tenantId, clienteNombre, rut, telefono, direccion,
    plan, canal, motivoLabel, conversacion,
    ticketId, perfilCliente, duracion, csatFinal,
    sentimientoFinal, fugaFinal, intencion, estado, totalMensajes,
    provider, model, aiProfileId
  } = req.body;

  if (!conversacion) {
    return res.status(400).json({ error: "conversacion requerido." });
  }

  const prompt =
    "Genera un resumen ejecutivo en exactamente 4 líneas con este formato:\n" +
    "1. Problema: ...\n2. Acciones: ...\n3. Resultado: ...\n4. Recomendación: ...\n\n" +
    `Cliente: ${clienteNombre} | Plan: ${plan} | Canal: ${canal} | Cierre: ${motivoLabel}\n\n` +
    conversacion;

  try {
    let summaryProvider = provider || 'anthropic';
    let summaryModel = model || 'claude-haiku-4-5-20251001';

    if (tenantId && !provider) {
      const { data: configData } = await supabase.from('tenant_ai_config').select('summary_llm_provider, summary_llm_model').eq('tenant_id', tenantId).maybeSingle();
      if (configData) {
        if (configData.summary_llm_provider) summaryProvider = configData.summary_llm_provider;
        if (configData.summary_llm_model) summaryModel = configData.summary_llm_model;
      }
    }

    // 1. Llama a LLM para generar el resumen
    const { text: resumenEjecutivo, usage } = await callLLM(supabase, {
      provider: summaryProvider,
      model: summaryModel,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });

    if (tenantId && usage) {
      logLLMUsage(supabase, {
        tenantId,
        aiProfileId: aiProfileId || null,
        provider: summaryProvider,
        model: summaryModel,
        usage
      }).catch(err => console.error("Error logging llm usage in /api/summarize:", err));
    }

    // 2. Persiste en Supabase con todos los campos de cierre
    if (tenantId && clienteNombre && resumenEjecutivo) {
      try {
        const contactId = await upsertContact({
          tenantId,
          clienteNombre,
          rut: rut || null,
          telefono: telefono || null,
          direccion: direccion || null,
          plan: plan || "",
          canal: canal || "",
        });

        // Busca la conversación activa (sin resumen = sesión recién cerrada)
        const { data: convs, error: findErr } = await supabase
          .from("conversations")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("contact_id", contactId)
          .is("resumen_ejecutivo", null)
          .order("last_message_at", { ascending: false })
          .limit(1);

        const conv = convs && convs.length > 0 ? convs[0] : null;

        if (findErr) throw findErr;

        if (conv) {
          // Parsea csat_final: si es numérico lo guarda, si no → null
          const csatNum = csatFinal && !isNaN(parseFloat(csatFinal))
            ? parseFloat(csatFinal)
            : null;

          const { error: updateErr } = await supabase
            .from("conversations")
            .update({
              resumen_ejecutivo: resumenEjecutivo,
              motivo_label: motivoLabel || null,
              ticket_id: ticketId || null,
              perfil_cliente: perfilCliente || null,
              duracion: duracion || null,
              csat_final: csatNum,
              sentimiento_final: sentimientoFinal || null,
              fuga_final: fugaFinal || null,
              intencion: intencion || null,
              estado: estado || null,
              total_mensajes: totalMensajes || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conv.id);
          if (updateErr) throw updateErr;
        }
      } catch (dbErr) {
        console.error("[Supabase /api/summarize]", dbErr.message);
        await insertAuditLog('error', 'api_summarize_db', dbErr.message, { stack: dbErr.stack, tenantId }, tenantId);
      }
    }

    return res.json({ content: [{ text: resumenEjecutivo }] });
  } catch (e) {
    console.error("[/api/summarize]", e);
    await insertAuditLog('error', 'api_summarize_claude', e.message, { stack: e.stack, tenantId }, tenantId);
    return res.status(e.status || 500).json({ error: e.message || "Error interno." });
  }
});

// ─── POST /api/contacts/:id/summarize ──────────────────────────────────────────
// Genera un resumen holístico del cliente basado en sus conversaciones
app.post("/api/contacts/:id/summarize", async (req, res) => {
  const { id } = req.params;
  try {
    const { data: contact, error: errContact } = await supabase.from("contacts").select("*").eq("id", id).single();
    if (errContact) throw errContact;

    const { data: convs, error: errConvs } = await supabase.from("conversations")
      .select("last_message_at, updated_at, canal, motivo_label, resumen_ejecutivo, csat_final")
      .eq("contact_id", id)
      .not("resumen_ejecutivo", "is", null)
      .order("last_message_at", { ascending: false });

    if (errConvs) throw errConvs;

    if (!convs || convs.length === 0) {
      return res.json({ summary: "No hay historial de resúmenes suficiente para generar un perfil." });
    }

    let historyText = `Cliente: ${contact.cliente_nombre}\nPlan/Producto: ${contact.plan || 'No definido'}\n\nHistorial de interacciones:\n`;
    convs.forEach((c, i) => {
      historyText += `--- Interacción ${i + 1} (${c.canal}) ---\nFecha: ${c.last_message_at || c.updated_at}\nCierre: ${c.motivo_label}\nCSAT: ${c.csat_final || 'N/A'}\nResumen:\n${c.resumen_ejecutivo}\n\n`;
    });

    const prompt = `Actúas como un analista experto de CRM. Lee el historial de interacciones de este cliente y genera un "Resumen Ejecutivo Global del Perfil del Cliente" (máximo 4 a 5 líneas). 
Enfócate en: 1) Nivel de satisfacción general o percepción de la marca, 2) Problemas o consultas recurrentes, 3) Recomendación clave de cómo tratarlo a futuro para ventas o retención.
No saludes ni te despidas, ve directo al reporte.

HISTORIAL:
${historyText}`;

    const { text: globalSummary } = await callLLM(supabase, {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400
    });

    await supabase.from("contacts").update({ global_summary: globalSummary }).eq("id", id);

    return res.json({ summary: globalSummary });
  } catch (e) {
    console.error("[/api/contacts/:id/summarize]", e);
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/admin/users ──────────────────────────────────────────────────────
// Obtiene la lista de usuarios. Bypass RLS con service_role.
app.get("/api/admin/users", async (req, res) => {
  const { filterTenantId } = req.query;

  try {
    let query = supabase
      .from('tenant_users')
      .select('*, tenants(name)')
      .order('created_at', { ascending: false });

    if (filterTenantId && filterTenantId !== 'null' && filterTenantId !== 'undefined') {
      query = query.eq('tenant_id', filterTenantId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json(data);
  } catch (e) {
    console.error("[/api/admin/users]", e.message);
    return res.status(500).json({ error: e.message || "Error interno al obtener usuarios." });
  }
});

// ─── POST /api/admin/users ─────────────────────────────────────────────────────
// Crea un usuario en Supabase Auth y lo asocia a un tenant
// Body: { tenantId, email, password, role, display_name, copilot_access }
app.post("/api/admin/users", async (req, res) => {
  const { tenantId, email, password, role = 'agent', display_name = '', copilot_access = false } = req.body;

  if (!tenantId || !email || !password) {
    return res.status(400).json({ error: "Faltan datos requeridos (tenantId, email, password)." });
  }

  try {
    // 1. Crear usuario en Auth usando el service_role (Admin API)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar para el demo
      user_metadata: { full_name: display_name }
    });

    if (authErr) throw authErr;

    const newUserId = authData.user.id;

    // 2. Asociar a tenant_users
    const { error: tenantErr } = await supabase
      .from('tenant_users')
      .insert({
        tenant_id: tenantId,
        user_id: newUserId,
        role: role,
        email: email,
        display_name: display_name,
        copilot_access: copilot_access
      });

    if (tenantErr) {
      // Intento de rollback si falla la vinculación (opcional, pero buena práctica)
      await supabase.auth.admin.deleteUser(newUserId);
      throw tenantErr;
    }

    return res.json({ success: true, user: authData.user });
  } catch (e) {
    console.error("[/api/admin/users]", e.message);
    await insertAuditLog('error', 'api_admin_users_create', e.message, { stack: e.stack, tenantId }, tenantId);
    return res.status(500).json({ error: e.message || "Error al crear usuario." });
  }
});

// ─── PUT /api/admin/users/:userId ─────────────────────────────────────────────
// Actualiza un usuario (rol, contraseña, estado activo, nombre, copilot_access)
app.put("/api/admin/users/:userId", async (req, res) => {
  const { userId } = req.params;
  const { password, role, is_active, display_name, copilot_access } = req.body;

  try {
    // 1. Actualizar contraseña y metadata en Auth (solo si se proveen)
    const authUpdates = {};
    if (password && password.trim() !== '') authUpdates.password = password;
    if (typeof display_name !== 'undefined') authUpdates.user_metadata = { full_name: display_name };

    if (Object.keys(authUpdates).length > 0) {
      const { error: authErr } = await supabase.auth.admin.updateUserById(userId, authUpdates);
      if (authErr) throw authErr;
    }

    // 2. Actualizar rol, estado y nombre en tenant_users
    const updates = {};
    if (role) updates.role = role;
    if (typeof is_active !== 'undefined') updates.is_active = is_active;
    if (typeof display_name !== 'undefined') updates.display_name = display_name;
    if (typeof copilot_access !== 'undefined') updates.copilot_access = copilot_access;

    if (Object.keys(updates).length > 0) {
      const { error: tenantErr } = await supabase
        .from('tenant_users')
        .update(updates)
        .eq('user_id', userId);

      if (tenantErr) throw tenantErr;
    }

    return res.json({ success: true });
  } catch (e) {
    console.error("[/api/admin/users/:userId]", e.message);
    return res.status(500).json({ error: e.message || "Error al actualizar usuario." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CRM ENDPOINTS ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/crm/conversations ───────────────────────────────────────────────
// Query: tenantId, status, campaignId, search, limit, offset
app.get("/api/crm/conversations", async (req, res) => {
  const { tenantId, status, canal, campaignId, search, limit = 50, offset = 0, userId, userRole, isSuperAdmin } = req.query;
  if (!tenantId) return res.status(400).json({ error: "tenantId requerido." });
  try {
    let query = supabase
      .from("conversations")
      .select(`
        id, ticket_id, status, canal, is_ai_active, assigned_to,
        last_message_at, last_message_preview, unread_count,
        sentimiento_final, fuga_final, intencion, csat_final,
        campaign_id, motivo_label,
        contacts(id, cliente_nombre, rut, telefono, email),
        campaigns(id, name, color, icon)
      `)
      .eq("tenant_id", tenantId)
      .order("last_message_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status && status !== "all") {
      if (status === "open") query = query.neq("status", "closed");
      else query = query.eq("status", status);
    }
    if (canal && canal !== "all") query = query.eq("canal", canal);
    if (campaignId) query = query.eq("campaign_id", campaignId);
    if (search) {
      query = query.or(
        `ticket_id.ilike.%${search}%,contacts.cliente_nombre.ilike.%${search}%`
      );
    }

    if (userId && userRole === 'agent' && isSuperAdmin !== 'true') {
      const { data: agentCamps } = await supabase.from('campaign_agents').select('campaign_id').eq('user_id', userId);
      const validIds = agentCamps ? agentCamps.map(ac => ac.campaign_id) : [];
      if (validIds.length > 0) {
        query = query.or(`campaign_id.in.(${validIds.join(',')}),campaign_id.is.null`);
      } else {
        query = query.is("campaign_id", null);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (e) {
    console.error("[GET /api/crm/conversations]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/crm/conversations/:id ───────────────────────────────────────────
// Retorna detalle completo: conversación + mensajes + datos del contacto
app.get("/api/crm/conversations/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [convRes, msgsRes] = await Promise.all([
      supabase
        .from("conversations")
        .select(`
          *, 
          contacts(*),
          campaigns(id, name, color, icon)
        `)
        .eq("id", id)
        .single(),
      supabase
        .from("conversation_messages")
        .select("*")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true }),
    ]);
    if (convRes.error) throw convRes.error;
    return res.json({ conversation: convRes.data, messages: msgsRes.data || [] });
  } catch (e) {
    console.error("[GET /api/crm/conversations/:id]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/crm/alerts ──────────────────────────────────────────────────────
// Retorna conteos y listado de alertas activas para el badge del sidebar
app.get("/api/crm/alerts", async (req, res) => {
  const { tenantId } = req.query;
  if (!tenantId) return res.status(400).json({ error: "tenantId requerido." });
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id, ticket_id, status, fuga_final, last_message_at, last_message_preview,
        contacts(cliente_nombre),
        campaigns(name, color)
      `)
      .eq("tenant_id", tenantId)
      .in("status", ["waiting_human"])
      .order("last_message_at", { ascending: true });
    if (error) throw error;
    return res.json({ count: data?.length || 0, alerts: data || [] });
  } catch (e) {
    console.error("[GET /api/crm/alerts]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/crm/campaigns ───────────────────────────────────────────────────
app.get("/api/crm/campaigns", async (req, res) => {
  const { tenantId } = req.query;
  if (!tenantId) return res.status(400).json({ error: "tenantId requerido." });
  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*, campaign_agents(user_id, can_takeover, can_close, is_supervisor)")
      .eq("tenant_id", tenantId)
      .order("created_at");
    if (error) throw error;
    return res.json(data || []);
  } catch (e) {
    console.error("[GET /api/crm/campaigns]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/crm/campaigns ──────────────────────────────────────────────────
app.post("/api/crm/campaigns", async (req, res) => {
  const { tenantId, name, description, color, icon, ai_profile_id } = req.body;
  if (!tenantId || !name) return res.status(400).json({ error: "tenantId y name requeridos." });
  try {
    const { data, error } = await supabase
      .from("campaigns")
      .insert({ tenant_id: tenantId, name, description, color, icon, ai_profile_id: ai_profile_id || null })
      .select().single();
    if (error) throw error;
    return res.json(data);
  } catch (e) {
    console.error("[POST /api/crm/campaigns]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.put("/api/crm/campaigns/:id", async (req, res) => {
  const { ai_profile_id } = req.body;
  try {
    const { data, error } = await supabase
      .from("campaigns")
      .update({ ai_profile_id: ai_profile_id || null })
      .eq("id", req.params.id)
      .select().single();
    if (error) throw error;
    return res.json(data);
  } catch (e) {
    console.error("[PUT /api/crm/campaigns]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── CAMPANAS Y TIPIFICACIONES (FASE 2) ───────────────────────────────────────

app.get("/api/crm/typification-templates", async (req, res) => {
  try {
    const { data, error } = await supabase.from("typification_templates").select("*").order("name");
    if (error) throw error;
    return res.json(data || []);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api/crm/campaigns/:id/typifications", async (req, res) => {
  try {
    const { data, error } = await supabase.from("campaign_typifications").select("*").eq("campaign_id", req.params.id).order("order_index", { ascending: true });
    if (error) throw error;
    return res.json(data || []);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/crm/campaigns/:id/typifications", async (req, res) => {
  const { tenantId, label } = req.body;
  try {
    const { data, error } = await supabase.from("campaign_typifications")
      .insert({ campaign_id: req.params.id, tenant_id: tenantId, label }).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.delete("/api/crm/campaigns/:id/typifications/:typId", async (req, res) => {
  try {
    const { error } = await supabase.from("campaign_typifications").delete().eq("id", req.params.typId);
    if (error) throw error;
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.put("/api/crm/campaigns/:id/typifications/reorder", async (req, res) => {
  const { typifications } = req.body; // array de { id, order_index }
  if (!Array.isArray(typifications)) return res.status(400).json({ error: "Invalid payload" });
  try {
    for (const t of typifications) {
      const { error } = await supabase.from("campaign_typifications")
        .update({ order_index: t.order_index })
        .eq("id", t.id);
      if (error) throw error;
    }
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/crm/campaigns/:id/agents", async (req, res) => {
  const { userId, canTakeover = true, canClose = true, isSupervisor = false } = req.body;
  try {
    const { data, error } = await supabase.from("campaign_agents")
      .insert({ campaign_id: req.params.id, user_id: userId, can_takeover: canTakeover, can_close: canClose, is_supervisor: isSupervisor })
      .select().single();
    if (error) throw error;
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.delete("/api/crm/campaigns/:id/agents/:userId", async (req, res) => {
  try {
    const { error } = await supabase.from("campaign_agents")
      .delete().eq("campaign_id", req.params.id).eq("user_id", req.params.userId);
    if (error) throw error;
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── AGENT TOOLS (Agentes Autónomos vía n8n) ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/crm/campaigns/:id/tools ─────────────────────────────────────────
app.get("/api/crm/campaigns/:id/tools", async (req, res) => {
  try {
    const { data, error } = await supabase.from('agent_tools')
      .select('*')
      .eq('campaign_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return res.json(data || []);
  } catch (e) {
    console.error("[GET /api/crm/campaigns/:id/tools]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/crm/campaigns/:id/tools ────────────────────────────────────────
app.post("/api/crm/campaigns/:id/tools", async (req, res) => {
  const { tenantId, name, label, description, n8n_workflow_id, input_schema } = req.body;
  if (!name || !label || !description || !n8n_workflow_id) {
    return res.status(400).json({ error: "name, label, description y n8n_workflow_id son requeridos." });
  }
  try {
    const { data, error } = await supabase.from('agent_tools').insert({
      campaign_id: req.params.id,
      tenant_id: tenantId || null,
      name: name.toLowerCase().replace(/\s+/g, '_'),
      label,
      description,
      n8n_workflow_id,
      input_schema: input_schema || null,
      is_active: true
    }).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (e) {
    console.error("[POST /api/crm/campaigns/:id/tools]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/agent-tools/:toolId ─────────────────────────────────────────────
app.put("/api/agent-tools/:toolId", async (req, res) => {
  const { name, label, description, n8n_workflow_id, input_schema, is_active } = req.body;
  try {
    const updates = {};
    if (name !== undefined)             updates.name = name.toLowerCase().replace(/\s+/g, '_');
    if (label !== undefined)            updates.label = label;
    if (description !== undefined)      updates.description = description;
    if (n8n_workflow_id !== undefined)  updates.n8n_workflow_id = n8n_workflow_id;
    if (input_schema !== undefined)     updates.input_schema = input_schema;
    if (is_active !== undefined)        updates.is_active = is_active;

    const { data, error } = await supabase.from('agent_tools')
      .update(updates).eq('id', req.params.toolId).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (e) {
    console.error("[PUT /api/agent-tools/:toolId]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/agent-tools/:toolId ──────────────────────────────────────────
app.delete("/api/agent-tools/:toolId", async (req, res) => {
  try {
    const { error } = await supabase.from('agent_tools').delete().eq('id', req.params.toolId);
    if (error) throw error;
    return res.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/agent-tools/:toolId]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/crm/campaigns/:id/n8n-config ────────────────────────────────────
app.get("/api/crm/campaigns/:id/n8n-config", async (req, res) => {
  try {
    const { data, error } = await supabase.from('campaigns')
      .select('n8n_webhook_url, n8n_secret_token, n8n_stage_change_webhook_id').eq('id', req.params.id).single();
    if (error) throw error;
    // No exponer el token completo, solo indicar si existe
    return res.json({
      n8n_webhook_url: data.n8n_webhook_url || '',
      has_secret_token: !!data.n8n_secret_token,
      n8n_stage_change_webhook_id: data.n8n_stage_change_webhook_id || ''
    });
  } catch (e) {
    console.error("[GET /api/crm/campaigns/:id/n8n-config]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/crm/campaigns/:id/n8n-config ────────────────────────────────────
app.put("/api/crm/campaigns/:id/n8n-config", async (req, res) => {
  const { n8n_webhook_url, n8n_secret_token, n8n_stage_change_webhook_id } = req.body;
  try {
    const updates = { 
      n8n_webhook_url: n8n_webhook_url || null,
      n8n_stage_change_webhook_id: n8n_stage_change_webhook_id || null
    };
    // Solo actualizar el token si se envió uno nuevo (no vacío)
    if (n8n_secret_token && n8n_secret_token.trim() !== '') {
      updates.n8n_secret_token = n8n_secret_token;
    }
    const { data, error } = await supabase.from('campaigns')
      .update(updates).eq('id', req.params.id).select('id, n8n_webhook_url, n8n_stage_change_webhook_id').single();
    if (error) throw error;
    return res.json({ success: true, n8n_webhook_url: data.n8n_webhook_url, n8n_stage_change_webhook_id: data.n8n_stage_change_webhook_id });
  } catch (e) {
    console.error("[PUT /api/crm/campaigns/:id/n8n-config]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/crm/campaigns/:id/test-n8n ─────────────────────────────────────
// Verifica que la URL de n8n está activa
app.post("/api/crm/campaigns/:id/test-n8n", async (req, res) => {
  const { n8n_webhook_url } = req.body;
  if (!n8n_webhook_url) return res.status(400).json({ error: 'n8n_webhook_url requerido.' });
  try {
    const testUrl = n8n_webhook_url.replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${testUrl}/healthz`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.json({ ok: response.ok, status: response.status });
  } catch (e) {
    return res.json({ ok: false, error: e.message });
  }
});

// ─── POST /api/webhook/n8n-email ───────────────────────────────────────────────
// Webhook entrante desde n8n para correos electrónicos
app.post("/api/webhook/n8n-email", async (req, res) => {
  const { tenantId, senderEmail, senderName, subject, textBody, messageId } = req.body;
  if (!tenantId || !senderEmail) return res.status(400).json({ error: "Faltan datos obligatorios (tenantId, senderEmail)." });
  
  try {
    const now = new Date().toISOString();
    // 1. Buscar o crear el contacto por email
    let { data: contact } = await supabase.from('contacts').select('*').eq('email', senderEmail).eq('tenant_id', tenantId).maybeSingle();
    if (!contact) {
      const { data: newContact, error: errC } = await supabase.from('contacts')
        .insert({ tenant_id: tenantId, cliente_nombre: senderName || senderEmail.split('@')[0], email: senderEmail })
        .select().single();
      if (errC) throw errC;
      contact = newContact;
    }

    // 2. Buscar conversación activa del contacto, si no existe, crear una nueva
    let { data: conv } = await supabase.from('conversations')
      .select('*').eq('contact_id', contact.id).eq('status', 'active').maybeSingle();
    
    // Guardar el Message-ID en metadata para threading
    const newMetadata = conv ? { ...(conv.metadata || {}), messageId } : { messageId };

    if (!conv) {
      const { data: newConv, error: errConv } = await supabase.from('conversations')
        .insert({ contact_id: contact.id, status: 'active', tenant_id: tenantId, last_message_at: now, canal: 'email', metadata: newMetadata })
        .select().single();
      if (errConv) throw errConv;
      conv = newConv;
    } else {
      // Actualizamos el metadata con el último messageId
      await supabase.from('conversations').update({ metadata: newMetadata }).eq('id', conv.id);
    }

    // 3. Insertar el mensaje
    const messageContent = subject ? `Asunto: ${subject}\n\n${textBody}` : textBody;
    await insertConvMessage({
      conversationId: conv.id,
      tenantId,
      senderType: 'customer',
      senderName: contact.cliente_nombre,
      content: messageContent,
      metadata: { messageId }
    });

    // 4. Actualizar preview
    await supabase.from("conversations").update({
      last_message_at: now,
      last_message_preview: messageContent.slice(0, 100)
    }).eq("id", conv.id);

    return res.json({ success: true, conversationId: conv.id });
  } catch (e) {
    console.error("[POST /api/webhook/n8n-email]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/crm/conversations/:id/messages ─────────────────────────────────
// Ejecutivo envía mensaje o nota interna
// Body: { tenantId, userId, displayName, content, isInternalNote }
app.post("/api/crm/conversations/:id/messages", async (req, res) => {
  const { id } = req.params;
  const { tenantId, userId, displayName, content, isInternalNote = false } = req.body;
  if (!content) return res.status(400).json({ error: "content requerido." });
  try {
    const now = new Date().toISOString();
    
    // Obtenemos la conversación primero
    const { data: conv } = await supabase.from("conversations").select("*").eq("id", id).single();
    if (!conv) return res.status(404).json({ error: "Conversación no encontrada" });

    // Insertar el mensaje del ejecutivo
    const { data: msg, error: msgErr } = await supabase
      .from("conversation_messages")
      .insert({
        conversation_id: id,
        tenant_id: tenantId,
        sender_type: "human_agent",
        sender_name: displayName || "Ejecutivo",
        sender_user_id: userId || null,
        content,
        is_internal_note: isInternalNote,
      })
      .select().single();
    if (msgErr) throw msgErr;

    // Actualizar preview en la conversación (solo si no es nota interna)
    if (!isInternalNote) {
      await supabase.from("conversations").update({
        last_message_at: now,
        last_message_preview: `[Ejecutivo] ${content.slice(0, 100)}`,
      }).eq("id", id);
      
      // Disparar Webhook Outbound a n8n si el canal es email
      if (conv.canal === 'email') {
        const { data: tenant } = await supabase.from('tenants').select('n8n_outbound_email_webhook').eq('id', tenantId).single();
        if (tenant && tenant.n8n_outbound_email_webhook) {
          const { data: contact } = await supabase.from('contacts').select('email').eq('id', conv.contact_id).single();
          const messageId = conv.metadata?.messageId || null;
          
          fetch(tenant.n8n_outbound_email_webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenantId,
              to: contact?.email,
              content,
              messageId,
              conversationId: id
            })
          }).catch(err => console.error("[Outbound Email Webhook] Error:", err.message));
        }
      }
    }
    
    return res.json(msg);
  } catch (e) {
    console.error("[POST /api/crm/conversations/:id/messages]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/crm/conversations/:id/suggest ──────────────────────────────────
// Ejecutivo pide sugerencia a la IA
app.post("/api/crm/conversations/:id/suggest", async (req, res) => {
  const { id } = req.params;
  const { tenantId } = req.body;
  try {
    const { data: conv } = await supabase.from("conversations").select("*").eq("id", id).single();
    if (!conv) return res.status(404).json({ error: "Conversación no encontrada" });

    // Buscar el último mensaje del cliente en el historial de la tabla de mensajes
    const { data: msgs } = await supabase.from("conversation_messages")
      .select("content")
      .eq("conversation_id", id)
      .eq("sender_type", "customer")
      .order("created_at", { ascending: false })
      .limit(1);

    const lastMessage = msgs && msgs.length > 0 ? msgs[0].content : "";
    if (!lastMessage) return res.json({ suggestion: "No hay mensajes del cliente para responder." });

    let systemPrompt = "Eres un asistente virtual experto.";
    let llmProvider = "anthropic";
    let llmModel = "claude-sonnet-4-6";
    let systemPromptBase = "Eres Kuden IA, un asistente virtual experto...";
    let aiProfileId = null;

    if (conv.campaign_id) {
      const { data: campaign } = await supabase.from("campaigns").select("ai_profile_id").eq("id", conv.campaign_id).maybeSingle();
      if (campaign?.ai_profile_id) {
        aiProfileId = campaign.ai_profile_id;
        const { data: profile } = await supabase.from("ai_profiles").select("persona_prompt, llm_provider, llm_model").eq("id", aiProfileId).maybeSingle();
        if (profile) {
          if (profile.persona_prompt) systemPrompt = profile.persona_prompt;
          if (profile.llm_provider) llmProvider = profile.llm_provider;
          if (profile.llm_model) llmModel = profile.llm_model;
        }
      }
    }

    let ragContext = "";
    if (aiProfileId) {
      const retrievedText = await retrieveKnowledge(lastMessage, supabase, tenantId, aiProfileId);
      if (retrievedText) {
        ragContext = `\n\n[BASE DE CONOCIMIENTO (RAG)]\nUtiliza la siguiente información interna de la empresa para basar tu sugerencia.\n\n${retrievedText}\n`;
      }
    }

    const { text } = await callLLM(supabase, {
      provider: llmProvider,
      model: llmModel,
      system: systemPrompt + ragContext + "\n\nINSTRUCCIÓN CRÍTICA: Debes sugerirle al ejecutivo humano exactamente el texto que debería enviarle al cliente como respuesta al último mensaje. NO escribas preámbulos, ni comillas, ni 'Hola ejecutivo'. Escribe DIRECTAMENTE la respuesta hacia el cliente.",
      messages: [{ role: "user", content: `Último mensaje del cliente:\n"${lastMessage}"` }],
      max_tokens: 500
    });

    return res.json({ suggestion: text });

  } catch (e) {
    console.error("[POST /api/crm/conversations/:id/suggest]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/crm/conversations/:id/takeover ─────────────────────────────────
// Body: { userId, displayName }
app.post("/api/crm/conversations/:id/takeover", async (req, res) => {
  const { id } = req.params;
  const { tenantId, userId, displayName } = req.body;
  try {
    const now = new Date().toISOString();
    await supabase.from("conversations").update({
      status: "human_active", is_ai_active: false,
      assigned_to: userId || null, updated_at: now,
    }).eq("id", id);
    // Mensaje de sistema
    await insertConvMessage({
      conversationId: id, tenantId,
      senderType: "system",
      content: `${displayName || "Un ejecutivo"} ha tomado el control de la conversación.`,
    });
    return res.json({ success: true });
  } catch (e) {
    console.error("[POST /api/crm/conversations/:id/takeover]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/crm/conversations/:id/release ──────────────────────────────────
// Devuelve el control a la IA
// Body: { tenantId, displayName }
app.post("/api/crm/conversations/:id/release", async (req, res) => {
  const { id } = req.params;
  const { tenantId, displayName } = req.body;
  try {
    await supabase.from("conversations").update({
      status: "active", is_ai_active: true, assigned_to: null,
    }).eq("id", id);
    await insertConvMessage({
      conversationId: id, tenantId,
      senderType: "system",
      content: `${displayName || "El ejecutivo"} devolvió el control a KUDEN IA.`,
    });
    return res.json({ success: true });
  } catch (e) {
    console.error("[POST /api/crm/conversations/:id/release]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/crm/conversations/:id/campaign ─────────────────────────────────
app.post("/api/crm/conversations/:id/campaign", async (req, res) => {
  const { id } = req.params;
  const { tenantId, campaignId, userId, displayName } = req.body;
  try {
    const { error } = await supabase.from("conversations").update({ campaign_id: campaignId || null }).eq("id", id).eq("tenant_id", tenantId);
    if (error) throw error;
    await insertConvMessage({
      conversationId: id, tenantId,
      senderType: "system",
      content: `Conversación reasignada de campaña por ${displayName || "ejecutivo"}.`,
    });
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/crm/conversations/:id/close ────────────────────────────────────
// Cierre formal o Dejar Pendiente
// Body: { tenantId, userId, displayName, force, motivoLabel, isPending, followUpAt, followUpNote }
app.post("/api/crm/conversations/:id/close", async (req, res) => {
  const { id } = req.params;
  const { tenantId, userId, displayName, force = false, motivoLabel = null, isPending = false, followUpAt = null, followUpNote = null } = req.body;
  try {
    const now = new Date().toISOString();
    let newStatus = force ? "closed" : "pending_csat";
    if (isPending) newStatus = "pending_followup";

    const updatePayload = {
      status: newStatus,
      is_ai_active: false,
    };

    if (isPending) {
      updatePayload.follow_up_at = followUpAt;
      updatePayload.follow_up_note = followUpNote;
      if (userId) updatePayload.assigned_to = userId;
    } else {
      updatePayload.closed_at = now;
      updatePayload.closed_by = userId || null;
      updatePayload.csat_requested_at = force ? null : now;
    }

    if (motivoLabel) updatePayload.motivo_label = motivoLabel;

    await supabase.from("conversations").update(updatePayload).eq("id", id);

    let sysContent = "";
    if (isPending) {
      sysContent = `${displayName || "El ejecutivo"} dejó la conversación pendiente para seguimiento.${followUpNote ? ` Nota: ${followUpNote}` : ''}`;
    } else {
      sysContent = force
        ? `Conversación cerrada por ${displayName || "ejecutivo"}.${motivoLabel ? ` Motivo: ${motivoLabel}` : ''}`
        : `${displayName || "El ejecutivo"} cerró la conversación y solicitó calificación CSAT.${motivoLabel ? ` Motivo: ${motivoLabel}` : ''}`;
    }

    await insertConvMessage({
      conversationId: id, tenantId,
      senderType: "system",
      content: sysContent,
    });
    return res.json({ success: true, status: newStatus });
  } catch (e) {
    console.error("[POST /api/crm/conversations/:id/close]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/crm/conversations/:id/typification ──────────────────────────────
// Actualiza la tipificación (motivo_label) sin cerrar el chat (para vista Kanban)
// Body: { tenantId, userId, displayName, motivoLabel }
app.post("/api/crm/conversations/:id/typification", async (req, res) => {
  const { id } = req.params;
  const { tenantId, userId, displayName, motivoLabel } = req.body;
  try {
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .select("*, contacts(*)")
      .eq("id", id).single();
    if (convErr) throw convErr;

    const oldStage = conv.motivo_label;

    const updatePayload = {
      motivo_label: motivoLabel || null,
      updated_at: new Date().toISOString()
    };
    
    await supabase.from("conversations").update(updatePayload).eq("id", id);
    
    await insertConvMessage({
      conversationId: id, tenantId,
      senderType: "system",
      content: `${displayName || "El ejecutivo"} cambió la etapa a: ${motivoLabel || "Sin Etapa"}.`,
    });
    
    // Gatillo n8n (Fase 3)
    if (motivoLabel && motivoLabel !== oldStage && conv.campaign_id) {
      const { data: campaign } = await supabase.from("campaigns").select("n8n_webhook_url, n8n_secret_token, n8n_stage_change_webhook_id").eq("id", conv.campaign_id).single();
      if (campaign?.n8n_webhook_url && campaign?.n8n_stage_change_webhook_id) {
         const payload = {
            event: "STAGE_CHANGED",
            timestamp: new Date().toISOString(),
            campaign_id: conv.campaign_id,
            conversation: {
              id: id,
              contact_phone: conv.contacts?.telefono,
              contact_name: conv.contacts?.cliente_nombre,
              old_stage: oldStage,
              new_stage: motivoLabel
            }
         };
         const stageHookUrl = `${campaign.n8n_webhook_url.replace(/\/$/, '')}/webhook/${campaign.n8n_stage_change_webhook_id}`;
         triggerN8nStageChange(stageHookUrl, campaign.n8n_secret_token, payload);
      }
    }

    return res.json({ success: true, motivo_label: motivoLabel });
  } catch (e) {
    console.error("[POST /api/crm/conversations/:id/typification]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/crm/stats ───────────────────────────────────────────────────────
// KPIs para la reportería. Query: tenantId, from, to, campaignId
app.get("/api/crm/stats", async (req, res) => {
  const { tenantId, from, to, campaignId } = req.query;
  if (!tenantId) return res.status(400).json({ error: "tenantId requerido." });
  try {
    let query = supabase
      .from("conversations")
      .select("status, canal, sentimiento_final, fuga_final, csat_final, intencion, closed_at, assigned_to, campaign_id")
      .eq("tenant_id", tenantId);
    if (campaignId) query = query.eq("campaign_id", campaignId);
    if (from) query = query.gte("last_message_at", from);
    if (to) query = query.lte("last_message_at", to);

    const { data, error } = await query;
    if (error) throw error;

    const total = data.length;
    const byStatus = {};
    const byCanal = {};
    const bySentimiento = {};
    const byFuga = {};
    const csatValues = [];
    let resolvedByAI = 0;
    let hadHuman = 0;

    data.forEach(c => {
      byStatus[c.status] = (byStatus[c.status] || 0) + 1;
      byCanal[c.canal || "—"] = (byCanal[c.canal || "—"] || 0) + 1;
      bySentimiento[c.sentimiento_final || "neutral"] = (bySentimiento[c.sentimiento_final || "neutral"] || 0) + 1;
      byFuga[c.fuga_final || "sin_riesgo"] = (byFuga[c.fuga_final || "sin_riesgo"] || 0) + 1;
      if (c.csat_final) csatValues.push(parseFloat(c.csat_final));
      if (c.status === "resolved") resolvedByAI++;
      if (c.status === "human_active" || c.status === "closed" || c.status === "pending_csat") hadHuman++;
    });

    const csatAvg = csatValues.length ? (csatValues.reduce((a, b) => a + b, 0) / csatValues.length).toFixed(2) : null;
    const fcrRate = total ? Math.round((resolvedByAI / total) * 100) : 0;
    const escalationRate = total ? Math.round((hadHuman / total) * 100) : 0;

    return res.json({
      total, fcrRate, escalationRate,
      csatAvg, csatCount: csatValues.length,
      byStatus, byCanal, bySentimiento, byFuga,
    });
  } catch (e) {
    console.error("[GET /api/crm/stats]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── Rutas de utilidad ─────────────────────────────────────────────────────────
app.get("/health", (_, res) => res.json({ status: "ok", service: "KUDEN IA Backend" }));

// ═══════════════════════════════════════════════════════════════════════════════
// ─── WIDGET PUBLIC ENDPOINTS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ─── ENDPOINTS ADMIN DE WEB WIDGETS ────────────────────────────────────────────────────
app.get("/api/web_widgets", async (req, res) => {
  const { tenantId } = req.query;
  try {
    const { data, error } = await supabase
      .from("web_widgets")
      .select("*, campaigns(name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/web_widgets", async (req, res) => {
  const { tenant_id, name, color, welcome_message, campaign_id, is_active } = req.body;
  try {
    const { data, error } = await supabase.from("web_widgets").insert([{
      tenant_id, name, color, welcome_message, campaign_id: campaign_id || null, is_active
    }]).select("*, campaigns(name)").single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/web_widgets/:id", async (req, res) => {
  const { id } = req.params;
  const { name, color, welcome_message, campaign_id, is_active } = req.body;
  try {
    const { data, error } = await supabase.from("web_widgets").update({
      name, color, welcome_message, campaign_id: campaign_id || null, is_active
    }).eq("id", id).select("*, campaigns(name)").single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/web_widgets/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from("web_widgets").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/widget/config ───────────────────────────────────────────────────
app.get("/api/widget/config", async (req, res) => {
  const { tenantId, widgetId } = req.query;
  if (!tenantId && !widgetId) return res.status(400).json({ error: "tenantId o widgetId requerido" });

  try {
    let widget = null;

    // Priorizar widgetId si existe
    if (widgetId && widgetId !== "null" && widgetId !== "undefined") {
      const { data: wData } = await supabase.from("web_widgets").select("*").eq("id", widgetId).maybeSingle();
      if (wData) widget = wData;
    }

    // Fallback: primer widget activo del tenant
    if (!widget && tenantId) {
      const { data: wData } = await supabase.from("web_widgets").select("*").eq("tenant_id", tenantId).eq("is_active", true).limit(1).maybeSingle();
      if (wData) widget = wData;
    }

    if (widget) {
      return res.json({
        name: widget.name,
        color: widget.color,
        welcome_message: widget.welcome_message,
        campaign_id: widget.campaign_id,
        require_contact_info: widget.require_contact_info,
        mode: "chat_only"
      });
    }

    // Fallback absoluto a tenant_ai_config antigua
    const { data: config } = await supabase.from("tenant_ai_config").select("*").eq("tenant_id", tenantId).maybeSingle();
    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", tenantId).maybeSingle();

    return res.json({
      name: tenant?.name || "Asistente",
      color: config?.widget_color || "#2563eb",
      welcome_message: "¡Hola! ¿En qué podemos ayudarte?",
      mode: config?.widget_capture_mode || "chat_only"
    });
  } catch (e) {
    console.error("[GET /api/widget/config]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/widget/chat ────────────────────────────────────────────────────
app.post("/api/widget/chat", async (req, res) => {
  const { tenantId, widgetId, conversationId, content } = req.body;
  if (!tenantId || !content) return res.status(400).json({ error: "Faltan datos" });

  try {
    const now = new Date().toISOString();
    let convId = conversationId;
    let history = [];
    let widgetConfig = null;
    let existingConv = null;

    if (widgetId && widgetId !== "null" && widgetId !== "undefined") {
      const { data: wc } = await supabase.from("web_widgets").select("campaign_id, welcome_message").eq("id", widgetId).maybeSingle();
      widgetConfig = wc;
    } else {
      const { data: wc } = await supabase.from("web_widgets").select("campaign_id, welcome_message").eq("tenant_id", tenantId).eq("is_active", true).limit(1).maybeSingle();
      widgetConfig = wc;
    }

    if (!convId) {
      // Crear nueva conversación (Cliente anónimo por ahora)
      // Generar ticket ID simple
      const ticketId = "WID-" + Math.floor(100000 + Math.random() * 900000);

      let { data: contact } = await supabase.from("contacts").select("id").eq("tenant_id", tenantId).eq("telefono", "WEB-CONTACT").maybeSingle();
      if (!contact) {
        const { data: newContact } = await supabase.from("contacts").insert([{ tenant_id: tenantId, telefono: "WEB-CONTACT", cliente_nombre: "Usuario Web Anónimo", canal: "webchat" }]).select("id").single();
        contact = newContact;
      }

      const insertConvData = {
        tenant_id: tenantId,
        ticket_id: ticketId,
        contact_id: contact.id,
        canal: "webchat",
        status: "active",
        is_ai_active: true,
        history: [],
        last_message_at: now,
        last_message_preview: content.slice(0, 100)
      };

      if (widgetConfig && widgetConfig.campaign_id) {
        insertConvData.campaign_id = widgetConfig.campaign_id;
      }

      const { data: newConvs, error: errIns } = await supabase
        .from("conversations")
        .insert(insertConvData)
        .select();
      if (errIns) throw errIns;
      if (!newConvs || newConvs.length === 0) throw new Error("No se pudo crear la conversación");
      convId = newConvs[0].id;

      // Inyectar el mensaje de bienvenida del widget (System) si está configurado en el historial inicial de memoria
      if (widgetConfig && widgetConfig.welcome_message) {
        history.push({ role: "system", content: widgetConfig.welcome_message, type: "system_greeting" });
      }

    } else {
      // Recuperar historial existente (usamos maybeSingle para no fallar si no existe)
      const { data: existing, error: errSel } = await supabase
        .from("conversations")
        .select("history, is_ai_active, status, contact_id")
        .eq("id", convId)
        .maybeSingle();
      if (errSel) throw errSel;

      existingConv = existing;

      if (!existing) {
        // Si la conversación no existe en BD (p.ej. limpiada), se crea una nueva con ese ID
        const ticketId = "WID-" + Math.floor(100000 + Math.random() * 900000);
        const { data: newConvs, error: errIns } = await supabase
          .from("conversations")
          .insert({
            id: convId,
            tenant_id: tenantId,
            ticket_id: ticketId,
            canal: "webchat",
            status: "active",
            is_ai_active: true,
            history: [],
            last_message_at: now,
            last_message_preview: content.slice(0, 100)
          })
          .select();
        if (errIns) throw errIns;
      } else if (!existing.is_ai_active) {
        // Guardar mensaje del cliente pero NO pasarlo a la IA si un humano tiene el control
        await insertConvMessage({ conversationId: convId, tenantId, senderType: "customer", content });
        await supabase.from("conversations").update({ last_message_at: now, last_message_preview: content.slice(0, 100), unread_count: 1 }).eq("id", convId);
        return res.json({ conversationId: convId, ai_response: null, info: "Humano en control" });
      } else {
        history = existing.history || [];
      }
    }

    // 1. Guardar mensaje del cliente
    await insertConvMessage({ conversationId: convId, tenantId, senderType: "customer", content });

    // 2. Añadir al historial para Claude
    history.push({ role: "user", content });

    // 3. Llamar a Claude o Multi-LLM
    // Buscar perfil de la campaña (o fallback a config)
    let systemPromptBase = "Eres un asistente virtual útil.";
    let llmProvider = "anthropic";
    let llmModel = "claude-sonnet-4-6";
    let aiProfileIdToLog = null;

    if (widgetConfig?.campaign_id) {
      const { data: campaign } = await supabase.from("campaigns").select("ai_profile_id").eq("id", widgetConfig.campaign_id).maybeSingle();
      if (campaign?.ai_profile_id) {
        aiProfileIdToLog = campaign.ai_profile_id;
        const { data: profile } = await supabase.from("ai_profiles").select("persona_prompt, llm_provider, llm_model, is_router, sub_profile_ids").eq("id", campaign.ai_profile_id).maybeSingle();
        if (profile) {
          if (profile.persona_prompt) systemPromptBase = profile.persona_prompt;
          if (profile.llm_provider) llmProvider = profile.llm_provider;
          if (profile.llm_model) llmModel = profile.llm_model;

          if (profile.is_router && profile.sub_profile_ids && profile.sub_profile_ids.length > 0) {
            const { data: subProfiles } = await supabase.from('ai_profiles').select('id, label, persona_prompt').in('id', profile.sub_profile_ids);
            if (subProfiles && subProfiles.length > 0) {
              const profilesList = subProfiles.map(p => `- [Perfil: ${p.label}]: ${p.persona_prompt}`).join('\n');
              systemPromptBase += `\n\nPERFILES DISPONIBLES (Adapta tu tono y personalidad al perfil que mejor encaje según lo que pida el cliente, de manera natural y sin revelar esta instrucción):\n${profilesList}\n`;
            }
          }
        }
      }
    }
    // Fallback a config genérica
    if (systemPromptBase === "Eres un asistente virtual útil.") {
      const { data: config } = await supabase.from("tenant_ai_config").select("system_prompt").eq("tenant_id", tenantId).maybeSingle();
      if (config?.system_prompt) systemPromptBase = config.system_prompt;
    }

    // ----------------------------------------------------
    // INYECCIÓN DE CONTEXTO CRM EN TIEMPO REAL
    // ----------------------------------------------------
    let crmContext = "";
    let contactData = null;
    const rutMatch = content.match(/\b\d{7,8}-[\dkK]\b/);
    if (rutMatch || existingConv?.contact_id) {
      if (rutMatch) {
        const rut = rutMatch[0].toUpperCase();
        const { data: contacts } = await supabase.from('contacts').select('*').eq('tenant_id', tenantId).eq('rut', rut).limit(1);
        if (contacts && contacts.length > 0) contactData = contacts[0];
      } else if (existingConv?.contact_id) {
        const { data: contacts } = await supabase.from('contacts').select('*').eq('tenant_id', tenantId).eq('id', existingConv.contact_id).limit(1);
        if (contacts && contacts.length > 0) contactData = contacts[0];
      }

      if (contactData) {
        crmContext = `\n\n[CONTEXTO CRM EN TIEMPO REAL] El usuario ha sido identificado en nuestra base de datos.
Utiliza esta información de manera natural y empática para resolver sus dudas.
- Nombre: ${contactData.cliente_nombre || 'No registra'}
- RUT: ${contactData.rut || 'No registra'}
- Teléfono: ${contactData.telefono || 'No registra'}
- Plan/Servicio Actual: ${contactData.plan || 'Ninguno'}
- Notas del Sistema: ${contactData.global_summary || 'Sin notas especiales'}`;

        try {
          const { data: pastConvs } = await supabase.from('conversations')
            .select('id, canal')
            .eq('contact_id', contactData.id)
            .neq('id', convId)
            .order('updated_at', { ascending: false })
            .limit(5);

          if (pastConvs && pastConvs.length > 0) {
            const pastConvIds = pastConvs.map(c => c.id);
            const { data: pastMsgs } = await supabase.from('conversation_messages')
              .select('sender_type, content, created_at, conversation_id')
              .in('conversation_id', pastConvIds)
              .order('created_at', { ascending: false })
              .limit(10);
            
            if (pastMsgs && pastMsgs.length > 0) {
              const formattedMsgs = pastMsgs.reverse().map(m => {
                const convInfo = pastConvs.find(c => c.id === m.conversation_id);
                const canal = convInfo ? convInfo.canal : 'desconocido';
                return `[${canal.toUpperCase()}] [${m.sender_type === 'customer' ? 'Cliente' : 'Asistente'}]: ${m.content}`;
              }).join('\n');
              crmContext += `\n\n[HISTORIAL OMNICANAL RECIENTE]\nEstos son extractos de conversaciones anteriores con el cliente en otros canales o tickets. Úsalo como memoria para darle continuidad si el cliente hace referencia a cosas pasadas:\n${formattedMsgs}`;
            }
          }
        } catch (err) {
          console.error("Error fetching omnichannel history", err.message);
        }
      }
    }

    // ----------------------------------------------------
    // INYECCIÓN DE CONOCIMIENTO (RAG) EN TIEMPO REAL
    // ----------------------------------------------------
    let ragContext = "";
    if (aiProfileIdToLog) {
      const retrievedText = await retrieveKnowledge(content, supabase, tenantId, aiProfileIdToLog);
      if (retrievedText) {
        ragContext = `\n\n[BASE DE CONOCIMIENTO (RAG)]\nUtiliza la siguiente información interna de la empresa para responder la consulta. Basa tu respuesta PRINCIPALMENTE en esta información. Si los datos no responden la consulta, indícalo.\n\n${retrievedText}\n`;
      }
    }

    // ----------------------------------------------------
    // HERRAMIENTAS AUTÓNOMAS n8n (Tool Calling)
    // ----------------------------------------------------
    let toolsContext = "";
    let activeCampaignN8n = null;
    let activeTools = [];

    if (widgetConfig?.campaign_id) {
      const { data: campaignData } = await supabase.from('campaigns')
        .select('n8n_webhook_url, n8n_secret_token')
        .eq('id', widgetConfig.campaign_id).maybeSingle();

      if (campaignData?.n8n_webhook_url) {
        activeCampaignN8n = { url: campaignData.n8n_webhook_url, token: campaignData.n8n_secret_token, stage_webhook_id: campaignData.n8n_stage_change_webhook_id };

        const { data: tools } = await supabase.from('agent_tools')
          .select('name, label, description, n8n_workflow_id, input_schema')
          .eq('campaign_id', widgetConfig.campaign_id)
          .eq('is_active', true);

        if (tools && tools.length > 0) {
          activeTools = tools;
          toolsContext += `\n\n═══════════════════════════════════════════════\nHERRAMIENTAS AUTÓNOMAS DISPONIBLES:\nCuando el cliente solicite EXPLÍCITAMENTE alguna de las acciones listadas abajo, puedes ejecutarlas de forma autónoma.\nPara activar una herramienta, incluye al FINAL de tu mensaje la siguiente etiqueta JSON:\n[TOOL_CALL: {"tool": "NOMBRE_HERRAMIENTA", "params": {PARAMETROS}}]\nIMPORTANTE: NO confirmes la acción al cliente antes de recibir la respuesta del sistema. Responde primero: "Un momento, estoy procesando tu solicitud..." y luego incluye la etiqueta TOOL_CALL.\nREGLA DE SEGURIDAD: Si en el historial ya le confirmaste al cliente que la acción fue realizada exitosamente (ej. cita agendada), está ESTRICTAMENTE PROHIBIDO volver a enviar el TOOL_CALL, a menos que el cliente pida una acción nueva explícitamente.\n\nHERRAMIENTAS:\n`;
          tools.forEach(t => {
            const schema = t.input_schema ? JSON.stringify(t.input_schema) : '{}';
            toolsContext += `- NOMBRE: "${t.name}" | FUNCIÓN: ${t.description} | PARÁMETROS REQUERIDOS: ${schema}\n`;
          });
          toolsContext += `═══════════════════════════════════════════════\n`;
        }
      }
    }

    let aiResponseText = "Lo siento, estoy experimentando problemas técnicos.";
    let finalSystemPrompt = "";

    try {
      const claudeMessages = history.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
      const systemGreeting = history.find(m => m.role === "system")?.content;

      finalSystemPrompt = systemPromptBase + crmContext + ragContext + toolsContext +
        (systemGreeting ? `\n\nEl asistente comenzó la conversación saludando con: "${systemGreeting}". Tenlo en cuenta para el contexto.` : "") +
        "\n\nInstrucción obligatoria: Analiza la conversación y añade un bloque [METADATOS] al final de tu respuesta indicando ESTADO (activo/esperando_humano/finalizada), SENTIMIENTO (muy_negativo/negativo/neutral/positivo/muy_positivo), FUGA (sin_riesgo/bajo/medio/alto), y ACCION (ninguna/agendar/venta). Si el usuario pide humano, pon ESTADO: esperando_humano. Si el usuario se despide o la conversación concluye, pon ESTADO: finalizada. Además, si a lo largo del chat el usuario indica sus datos personales, extrae y añade en el bloque de metadatos: NOMBRE (nombre completo o nombre), RUT, TELEFONO, DIRECCION. Ej: [NOMBRE: Juan Pérez][TELEFONO: +569...].";

      if (widgetConfig?.campaign_id) {
        const { data: typs } = await supabase.from("campaign_typifications").select("label").eq("campaign_id", widgetConfig.campaign_id).order("order_index", { ascending: true });
        if (typs && typs.length > 0) {
          finalSystemPrompt += `\n\nTIPIFICACIONES (ETAPAS KANBAN) DE ESTA CAMPAÑA:\n`;
          typs.forEach(t => {
            finalSystemPrompt += `- "${t.label}"\n`;
          });
          finalSystemPrompt += `\nINSTRUCCIÓN DE TIPIFICACIÓN Y ETAPAS: Evalúa el estado de la conversación y la intención del cliente, y OBLIGATORIAMENTE incluye al final de tu mensaje la etiqueta [ETAPA: <nombre de la etapa>] usando exactamente una de las tipificaciones anteriores. Esto moverá automáticamente la tarjeta del cliente en nuestro Tablero Kanban. Si la conversación recién empieza, usa la etapa inicial o más apropiada. Además, si logras resolver completamente la solicitud por tu cuenta, debes marcar [ESTADO: finalizado].\n`;
        } else {
          finalSystemPrompt += `\n\nAdemás, OBLIGATORIAMENTE añade la etiqueta [ETAPA: <nombre de etapa>] basándote en la intención actual del usuario (ej: [ETAPA: Nueva campaña], [ETAPA: Cotizando], [ETAPA: Cerrado]).`;
        }
      } else {
        finalSystemPrompt += `\n\nAdemás, OBLIGATORIAMENTE añade la etiqueta [ETAPA: <nombre de etapa>] basándote en la intención actual del usuario (ej: [ETAPA: Nueva campaña], [ETAPA: Cotizando], [ETAPA: Cerrado]).`;
      }

      const { text, usage } = await callLLM(supabase, {
        provider: llmProvider,
        model: llmModel,
        system: finalSystemPrompt,
        messages: claudeMessages,
        max_tokens: 1024
      });
      aiResponseText = text;

      // ─── Intercepción de Tool Call (Agentes Autónomos vía n8n) ──────────────────
      const toolCallMatch = aiResponseText.match(/\[TOOL_CALL:\s*({[\s\S]*?})\]/);
      if (toolCallMatch && activeCampaignN8n && activeTools.length > 0) {
        try {
          const toolCallData = JSON.parse(toolCallMatch[1]);
          const toolName = toolCallData.tool;
          const toolParams = toolCallData.params || {};
          const toolDef = activeTools.find(t => t.name === toolName);

          if (toolDef) {
            // Enriquecer el payload con datos del contacto
            const enrichedParams = {
              ...toolParams,
              _kuden_tenant_id: tenantId || null,
              _kuden_campaign_id: widgetConfig?.campaign_id || null,
              _kuden_contact_name: contactData?.cliente_nombre || null,
              _kuden_contact_phone: contactData?.telefono || null,
            };

            const n8nResult = await callN8nTool(
              activeCampaignN8n.url,
              activeCampaignN8n.token,
              toolDef.n8n_workflow_id,
              enrichedParams
            );

            await insertAuditLog('info', 'agent_tool_call_widget', `Tool "${toolName}" ejecutada exitosamente.`, {
              tool: toolName, params: toolParams, n8nResult
            }, tenantId);

            const n8nResultText = JSON.stringify(n8nResult);
            const { text: finalResponseWithResult } = await callLLM(supabase, {
              provider: llmProvider,
              model: llmModel,
              system: finalSystemPrompt,
              messages: [
                ...claudeMessages,
                { role: 'assistant', content: aiResponseText },
                { role: 'user', content: `[RESULTADO DEL SISTEMA]: La herramienta "${toolDef.label}" se ejecutó correctamente. Resultado: ${n8nResultText}. Ahora informa al cliente de forma amigable y natural sobre el resultado, sin mostrar datos técnicos JSON. Usa la información del resultado para dar una respuesta clara y concreta. Recuerda añadir siempre los [METADATOS].` }
              ],
              max_tokens: 1024
            });

            aiResponseText = finalResponseWithResult;
          } else {
            console.warn(`[TOOL_CALL] Tool "${toolName}" no encontrada en el widget.`);
            await insertAuditLog('warning', 'agent_tool_call_widget', `Tool "${toolName}" no encontrada.`, { toolName }, tenantId);
          }
        } catch (toolErr) {
          console.error("[TOOL_CALL Error en Widget]", toolErr.message);
          await insertAuditLog('error', 'agent_tool_call_widget', `Error al ejecutar tool call: ${toolErr.message}`, { error: toolErr.message }, tenantId);
          aiResponseText = aiResponseText.replace(/\[TOOL_CALL:[\s\S]*?\]/g, '').trim();
        }
      } else if (toolCallMatch) {
        aiResponseText = aiResponseText.replace(/\[TOOL_CALL:[\s\S]*?\]/g, '').trim();
      }
      // ─── Fin Intercepción Tool Call ───────────────────────────────────────────────

      // Facturar/Loggear uso
      await logLLMUsage(supabase, {
        tenantId,
        campaignId: widgetConfig?.campaign_id,
        aiProfileId: aiProfileIdToLog,
        provider: llmProvider,
        model: llmModel,
        usage
      });

    } catch (e) { console.error("Error LLM:", e.message); }

    const metadata = parseClaudeMetadata(aiResponseText);
    const cleanText = aiResponseText.replace(/\[METADATOS\][\s\S]*/i, '').trim() || aiResponseText;
    history.push({ role: "assistant", content: cleanText });

    // 4. Guardar respuesta de la IA
    await insertConvMessage({ conversationId: convId, tenantId, senderType: "ai", content: cleanText });

    // 4.5. Upsert de Contacto si hay datos
    let contactId = null;
    if (metadata.nombre) {
      try {
        contactId = await upsertContact({
          tenantId,
          clienteNombre: metadata.nombre,
          rut: metadata.rut,
          telefono: metadata.telefono,
          direccion: metadata.direccion,
          canal: "webchat"
        });
      } catch (err) {
        console.error("Error upserting contact:", err.message);
      }
    }

    // 5. Actualizar la conversación
    const needsHuman = metadata.estado === "esperando_humano" || metadata.fuga === "alto";
    const isFinished = metadata.estado === "finalizada";

    let updateFields = {
      history,
      status: isFinished ? "pending_csat" : (needsHuman ? "waiting_human" : "active"),
      is_ai_active: (needsHuman || isFinished) ? false : true,
      last_message_at: new Date().toISOString(),
      last_message_preview: cleanText.slice(0, 100),
      sentimiento_final: metadata.sentimiento,
      fuga_final: metadata.fuga,
      intencion: metadata.accion,
    };
    let oldStage = existingConv.motivo_label;
    if (metadata.etapa) {
      updateFields.motivo_label = metadata.etapa;
    }
    if (contactId) updateFields.contact_id = contactId;

    console.log("AI Raw text:", aiResponseText);
    console.log("AI Parsed metadata:", metadata);

    await supabase.from("conversations").update(updateFields).eq("id", convId);

    // Gatillo n8n (Fase 3)
    if (metadata.etapa && metadata.etapa !== oldStage && activeCampaignN8n && activeCampaignN8n.stage_webhook_id) {
      const payload = {
        event: "STAGE_CHANGED",
        timestamp: new Date().toISOString(),
        campaign_id: widgetConfig?.campaign_id,
        conversation: {
          id: convId,
          contact_phone: contactData?.telefono || metadata.telefono,
          contact_name: contactData?.cliente_nombre || metadata.nombre,
          old_stage: oldStage,
          new_stage: metadata.etapa
        }
      };
      // No esperamos (await) para no bloquear la respuesta al usuario
      const stageHookUrl = `${activeCampaignN8n.url.replace(/\/$/, '')}/webhook/${activeCampaignN8n.stage_webhook_id}`;
      triggerN8nStageChange(stageHookUrl, activeCampaignN8n.token, payload);
    }

    return res.json({
      conversationId: convId,
      ai_response: cleanText,
      needsCsat: isFinished
    });
  } catch (e) {
    console.error("[POST /api/widget/chat]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/widget/chat/:id ─────────────────────────────────────────────────
app.get("/api/widget/chat/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // 1. Obtener la conversación para conocer el estado y calificación CSAT
    const { data: conv, error: errConv } = await supabase
      .from("conversations")
      .select("status, csat_final")
      .eq("id", id)
      .maybeSingle();

    if (errConv) throw errConv;

    // 2. Obtener mensajes no internos
    const { data: messages, error: errMsgs } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", id)
      .eq("is_internal_note", false)
      .order("created_at", { ascending: true });

    if (errMsgs) throw errMsgs;

    return res.json({
      status: conv?.status || "active",
      csat_final: conv?.csat_final || null,
      messages: messages || []
    });
  } catch (e) {
    console.error("[GET /api/widget/chat/:id]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ─── POST /api/widget/csat ────────────────────────────────────────────────────
app.post("/api/widget/csat", async (req, res) => {
  const { tenantId, conversationId, score } = req.body;
  if (!tenantId || !conversationId || !score) return res.status(400).json({ error: "Faltan datos" });

  try {
    await supabase.from("conversations").update({
      csat_final: parseInt(score),
      status: "closed",
      closed_at: new Date().toISOString()
    }).eq("id", conversationId).eq("tenant_id", tenantId);
    return res.json({ success: true });
  } catch (e) {
    console.error("[POST /api/widget/csat]", e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RAG ENDPOINTS ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

app.post("/api/profiles/:profileId/documents", upload.single('file'), async (req, res) => {
  const { profileId } = req.params;
  const { tenantId, type, url } = req.body;
  const file = req.file;

  if (!tenantId) return res.status(400).json({ error: "tenantId requerido." });
  if (!type || !['pdf', 'md', 'web'].includes(type)) return res.status(400).json({ error: "type inválido." });
  if (type === 'web' && !url) return res.status(400).json({ error: "URL requerida para type web." });
  if (type !== 'web' && !file) return res.status(400).json({ error: "Archivo requerido." });

  try {
    const source = type === 'web' ? url : file.buffer;
    const name = type === 'web' ? url : file.originalname;

    // Validar propiedad del perfil
    const { data: profile, error: profErr } = await supabase
      .from('ai_profiles')
      .select('tenant_id')
      .eq('id', profileId)
      .single();

    if (profErr || profile.tenant_id !== tenantId) {
      return res.status(403).json({ error: "No tienes permiso para modificar este perfil." });
    }

    const result = await processAndStoreKnowledge({
      supabase,
      tenantId,
      profileId,
      name,
      type,
      source,
      provider: 'gemini'
    });

    return res.json({ success: true, ...result });
  } catch (e) {
    console.error("[POST /api/profiles/.../documents]", e);
    return res.status(500).json({ error: e.message });
  }
});

app.get("/api/profiles/:profileId/documents", async (req, res) => {
  const { profileId } = req.params;
  const { tenantId } = req.query;

  if (!tenantId) return res.status(400).json({ error: "tenantId requerido." });

  try {
    const { data, error } = await supabase
      .from('knowledge_documents')
      .select('id, name, source_type, created_at')
      .eq('profile_id', profileId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(data);
  } catch (e) {
    console.error("[GET /api/profiles/.../documents]", e);
    return res.status(500).json({ error: e.message });
  }
});

app.delete("/api/documents/:documentId", async (req, res) => {
  const { documentId } = req.params;
  const { tenantId } = req.query;

  if (!tenantId) return res.status(400).json({ error: "tenantId requerido." });

  try {
    const { error } = await supabase
      .from('knowledge_documents')
      .delete()
      .eq('id', documentId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return res.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/documents/:id]", e);
    return res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PREDICTIVE INSIGHTS (KIMI BI) ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/api/insights/macro", async (req, res) => {
  const { tenantId, generate } = req.query;
  if (!tenantId) return res.status(400).json({ error: "tenantId requerido." });

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const startDateStr = thirtyDaysAgo.toISOString();

    // 1. Obtener conversaciones de los últimos 30 días
    const { data: convs, error: convsErr } = await supabase
      .from('conversations')
      .select('id, status, duracion, csat_final, fuga_final, total_mensajes, assigned_to')
      .eq('tenant_id', tenantId)
      .gte('updated_at', startDateStr);

    if (convsErr) throw convsErr;

    let totalConvs = convs.length;
    let totalCsat = 0, csatCount = 0;
    let fugaRisk = { alto: 0, medio: 0, bajo: 0, sin_riesgo: 0 };
    const agentsMap = {};

    convs.forEach(c => {
      if (c.csat_final) {
        totalCsat += c.csat_final;
        csatCount++;
      }
      if (c.fuga_final && fugaRisk[c.fuga_final] !== undefined) {
        fugaRisk[c.fuga_final]++;
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

    // Si solo piden datos crudos, retornar el payload
    if (generate !== 'true') {
      return res.json({ success: true, data: payload });
    }

    // 2. Si piden reporte IA, pasamos el payload a Kimi
    const { data: tenant } = await supabase.from('tenants').select('name').eq('id', tenantId).single();
    const { data: config } = await supabase.from('ai_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
    const provider = config?.default_provider || 'anthropic';
    const model = config?.default_model || 'claude-haiku-4-5-20251001';

    const systemPrompt = `Eres Kimi, Analista de Datos y Co-Piloto Estratégico de "${tenant?.name || 'la empresa'}".
Tu objetivo es leer los siguientes datos agregados de los últimos 30 días y redactar un informe ejecutivo (en formato Markdown).
Estructura sugerida:
1. Resumen Ejecutivo (Conclusión de 2 líneas)
2. Rendimiento Global (CSAT, Volumen de Casos, Riesgo de Fuga)
3. Evaluación de Ejecutivos (Menciona al top performer y áreas de mejora si aplica)
4. Recomendaciones Proactivas (2 o 3 ideas concretas para mejorar el servicio).

Usa un tono analítico, corporativo y perspicaz. ¡NO ALUCINES DATOS que no estén en este JSON!

DATOS CRUDOS A ANALIZAR:
${JSON.stringify(payload, null, 2)}`;

    const { callLLM } = await import('./llmService.js');
    
    // Llamada a LLM
    const llmResponse = await callLLM(supabase, {
      provider,
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Genera el informe ejecutivo de los últimos 30 días basado en los datos proporcionados.' }]
    });

    if (llmResponse.error) throw new Error(llmResponse.error);

    // Facturación (Asignamos source: 'insights')
    await supabase.from('llm_usage_logs').insert({
      tenant_id: tenantId, provider, model, source: 'insights',
      prompt_tokens: llmResponse.usage.prompt_tokens,
      completion_tokens: llmResponse.usage.completion_tokens,
      api_cost_usd: llmResponse.cost.api_cost,
      billed_usd: llmResponse.cost.billed_cost
    });

    return res.json({ 
      success: true, 
      data: payload,
      report: llmResponse.text
    });

  } catch (e) {
    console.error("[GET /api/insights/macro]", e);
    return res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COPILOT ENDPOINTS (KIMI) ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

app.get("/api/copilot/history", async (req, res) => {
  const { tenantId, userId } = req.query;
  if (!tenantId || !userId) return res.status(400).json({ error: "tenantId y userId requeridos." });
  
  try {
    const { data: conv } = await supabase
      .from("copilot_conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!conv) return res.json({ messages: [] });

    const { data: msgs } = await supabase
      .from("copilot_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true });

    return res.json({ conversationId: conv.id, messages: msgs || [] });
  } catch (e) {
    console.error("[GET /api/copilot/history]", e);
    return res.status(500).json({ error: e.message });
  }
});

app.delete("/api/copilot/history", async (req, res) => {
  const { tenantId, userId } = req.query;
  if (!tenantId || !userId) return res.status(400).json({ error: "tenantId y userId requeridos." });

  try {
    const { data: conv } = await supabase
      .from("copilot_conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!conv) return res.json({ success: true });

    const { error } = await supabase
      .from("copilot_messages")
      .delete()
      .eq("conversation_id", conv.id);

    if (error) throw error;
    return res.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/copilot/history]", e);
    return res.status(500).json({ error: e.message });
  }
});

app.post("/api/copilot/chat", async (req, res) => {
  const { tenantId, userId, message } = req.body;
  if (!tenantId || !userId || !message) return res.status(400).json({ error: "Faltan parámetros." });

  try {
    // 1. Obtener o crear conversación
    let { data: conv } = await supabase
      .from("copilot_conversations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!conv) {
      const { data: newConv, error: errConv } = await supabase
        .from("copilot_conversations")
        .insert({ tenant_id: tenantId, user_id: userId, title: "Chat con Kimi" })
        .select("id").single();
      if (errConv) throw errConv;
      conv = newConv;
    }

    // 2. Guardar mensaje del usuario
    await supabase.from("copilot_messages").insert({
      conversation_id: conv.id,
      sender_type: "user",
      content: message
    });

    // 3. Historial (últimos 10)
    const { data: history } = await supabase
      .from("copilot_messages")
      .select("sender_type, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(10);
    
    let chatHistory = [];
    if (history && history.length > 0) {
      chatHistory = history.reverse().map(m => ({
        role: m.sender_type === "user" ? "user" : "assistant",
        content: m.content
      }));
    }

    // Asegurarse de que el último mensaje no está duplicado en el chatHistory 
    // (el chatHistory de anthropic/openai espera los previos, y nosotros lo adjuntaremos)
    // Extraemos todos los mensajes excepto el último (que acabamos de insertar y es de type "user")
    const systemHistory = chatHistory.slice(0, -1);
    
    // 4. Inyectar Contexto de Empresa y RAG general
    const { data: tenant } = await supabase.from("tenants").select("name").eq("id", tenantId).single();
    
    // Obtener fecha de hoy para métricas diarias
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDayStr = today.toISOString();

    let advancedMetricsPrompt = "";

    try {
      // Obtener estadísticas en tiempo real — GLOBALES
    const { count: totalContacts } = await supabase.from("contacts").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId);
    const { count: newContactsToday } = await supabase.from("contacts").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId).gte("created_at", startOfDayStr);
    
    const { count: totalCampaigns } = await supabase.from("campaigns").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId);
    const { count: activeCampaigns } = await supabase.from("campaigns").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId).eq("is_active", true);
    
    const { count: activeTickets } = await supabase.from("conversations").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId).not("status", "in", "(closed,pending_csat,resolved,abandoned)");
    const { count: ticketsClosedToday } = await supabase.from("conversations").select("*", { count: 'exact', head: true }).eq("tenant_id", tenantId).in("status", ["closed", "pending_csat", "resolved"]).gte("updated_at", startOfDayStr);

      // Desglose POR CAMPAÑA — para preguntas de seguimiento
      const { data: campaigns } = await supabase.from("campaigns").select("id, name, is_active").eq("tenant_id", tenantId);
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
          return `  - Campaña: "${camp.name}" (Activa: ${camp.is_active ? 'Sí' : 'No'}) → Conv. abiertas: ${campActive || 0} | Cerradas hoy: ${campClosedToday || 0}`;
        }));
        campaignBreakdown = `\n[DESGLOSE OPERACIONAL POR CAMPAÑA (HOY)]\n${breakdownRows.join('\n')}`;
      }

      // Top 5 Contactos de Hoy
      let topContactsString = "";
      const { data: convsToday } = await supabase.from("conversations")
        .select("contact_id, total_mensajes")
        .eq("tenant_id", tenantId)
        .gte("updated_at", startOfDayStr);

      if (convsToday && convsToday.length > 0) {
        const contactActivity = {};
        for (const c of convsToday) {
          if (!c.contact_id) continue;
          contactActivity[c.contact_id] = (contactActivity[c.contact_id] || 0) + (c.total_mensajes || 1);
        }
        const topContacts = Object.entries(contactActivity).sort((a, b) => b[1] - a[1]).slice(0, 5);
        
        if (topContacts.length > 0) {
          const { data: contactsData } = await supabase.from("contacts")
            .select("id, cliente_nombre, telefono, email")
            .in("id", topContacts.map(t => t[0]));
          const contactMap = {};
          if (contactsData) contactsData.forEach(c => contactMap[c.id] = c);
          
          const topRows = topContacts.map(([id, msgs], i) => {
            const c = contactMap[id] || { cliente_nombre: "Desconocido", telefono: "N/A" };
            return `  ${i+1}. ${c.cliente_nombre || c.telefono || c.email} (${msgs} interacciones)`;
          });
          topContactsString = `\n\n[TOP 5 CONTACTOS MÁS ACTIVOS DE HOY]\n${topRows.join('\n')}`;
        }
      }

      advancedMetricsPrompt = `
[MÉTRICAS EN TIEMPO REAL DEL CRM (OPERACIÓN ACTUAL)]
Al momento de responder, tienes acceso a los datos vivos de la empresa. Estos son los números oficiales:
- Contactos totales en la base de datos: ${totalContacts || 0}
- Nuevos contactos capturados HOY: ${newContactsToday || 0}
- Campañas totales configuradas: ${totalCampaigns || 0} (Activas en este momento: ${activeCampaigns || 0})
- Tickets/Conversaciones ABIERTAS (esperando atención): ${activeTickets || 0}
- Tickets/Conversaciones COMPLETADAS/CERRADAS HOY: ${ticketsClosedToday || 0}
${campaignBreakdown}${topContactsString}

Usa estos datos con total seguridad cuando te pregunten sobre la operación de hoy, cuántos contactos o campañas hay, con quién se ha hablado más, o cómo va el rendimiento por campaña. Cuando puedas, ofrece conclusiones analíticas y sugerencias de acción.`;

    } catch (metricErr) {
      console.error("[Copilot Metrics Error]", metricErr);
      await insertAuditLog('error', 'system_error', `Error calculando métricas de Kimi: ${metricErr.message}`, { error: metricErr.message, stack: metricErr.stack }, tenantId);
      advancedMetricsPrompt = `\n[MÉTRICAS EN TIEMPO REAL DEL CRM (OPERACIÓN ACTUAL)]\nOcurrió un error al cargar las métricas en tiempo real. Informa al usuario que revisen el System Health Dashboard.`;
    }

    // RAG: Buscamos documentos genéricos (sin aiProfileId limitante)
    const retrievedText = await retrieveKnowledge(message, supabase, tenantId, null);
    
    let systemPrompt = `Eres Kimi, el Co-Piloto Corporativo y consultor estratégico interno de la empresa "${tenant?.name || 'Kuden'}".
Tu objetivo es ayudar a los ejecutivos de la empresa con información analítica, estrategias comerciales, redacción de correos, y asistencia operativa. 
Eres muy inteligente, amable, analítica y proactiva. 
Usa formato Markdown enriquecido de GitHub (ej. tablas, listas, negritas, código) para que tus respuestas sean fáciles de leer y estructuradas.
NUNCA asumas que eres un bot de atención a clientes externos. Eres una colega interna y consultora para el equipo.
${advancedMetricsPrompt}`;

    if (retrievedText) {
      systemPrompt += `\n\n[BASE DE CONOCIMIENTO INTERNA]\nAquí tienes fragmentos de documentos de la empresa que pueden ayudar a responder la consulta del ejecutivo:\n${retrievedText}\n`;
    }

    // 5. Llamar al LLM (usamos Claude Sonnet por defecto para el Co-Piloto por ser muy inteligente)
    systemHistory.push({ role: 'user', content: message });
    
    let kimiProvider = 'anthropic';
    let kimiModel = 'claude-sonnet-4-6';

    const { data: configData } = await supabase.from('tenant_ai_config').select('kimi_llm_provider, kimi_llm_model').eq('tenant_id', tenantId).maybeSingle();
    if (configData) {
      if (configData.kimi_llm_provider) kimiProvider = configData.kimi_llm_provider;
      if (configData.kimi_llm_model) kimiModel = configData.kimi_llm_model;
    }

    const { text: kimiResponse, usage } = await callLLM(supabase, {
      provider: kimiProvider,
      model: kimiModel,
      system: systemPrompt,
      messages: systemHistory,
      max_tokens: 1500
    });

    // 6. Guardar respuesta y loggear uso LLM
    const { data: aiMsg } = await supabase.from("copilot_messages").insert({
      conversation_id: conv.id,
      sender_type: "ai",
      content: kimiResponse
    }).select().single();

    // Log del uso para el Tarificador
    await logLLMUsage(supabase, {
      tenantId,
      campaignId: null,
      aiProfileId: null,
      provider: kimiProvider,
      model: kimiModel,
      usage,
      source: 'copilot'
    });

    return res.json({ message: aiMsg });
  } catch (e) {
    console.error("[POST /api/copilot/chat]", e);
    return res.status(500).json({ error: e.message });
  }
});

// Fin de Widget Endpoints
app.listen(PORT, '0.0.0.0', () => console.log(`KUDEN IA Backend en http://0.0.0.0:${PORT}`));
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
    let query = supabase
      .from('audit_logs')
      .select('id, severity, source, message, metadata, tenant_id, created_at')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (severity && severity !== 'all') query = query.eq('severity', severity);
    if (source && source !== 'all')   query = query.eq('source', source);
    if (tenantId)                     query = query.eq('tenant_id', tenantId);
    if (from)                         query = query.gte('created_at', from);
    if (to)                           query = query.lte('created_at', to);
    if (search)                       query = query.ilike('message', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    // Calcular stats agregadas
    const logs = data || [];
    const bySeverity = logs.reduce((acc, l) => {
      acc[l.severity] = (acc[l.severity] || 0) + 1;
      return acc;
    }, {});
    const bySource = logs.reduce((acc, l) => {
      acc[l.source] = (acc[l.source] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      logs,
      stats: {
        total: logs.length,
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
    updatePayload.motivo_label = parsedMeta?.accion || "Resuelto por IA";
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
  const { system, messages, max_tokens, contactData } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages requerido y debe ser un arreglo." });
  }

  try {
    let finalSystemPrompt = system || "";
    let activeCampaignId = null;

    if (contactData?.tenantId) {
      const { data: camps } = await supabase.from('campaigns').select('id, name, description').eq('tenant_id', contactData.tenantId);
      if (camps && camps.length > 0) {
        finalSystemPrompt += `\n\nCAMPAÑAS DISPONIBLES (Departamentos):\n`;
        camps.forEach(c => {
          finalSystemPrompt += `- [ID: ${c.id}] ${c.name}: ${c.description || ''}\n`;
        });
        finalSystemPrompt += `\nINSTRUCCIÓN DE ENRUTAMIENTO: Si según el mensaje del cliente puedes identificar claramente a qué departamento/campaña corresponde su solicitud, añade al final EXACTAMENTE la etiqueta [CAMPAÑA: ID_DE_LA_CAMPAÑA] (reemplazando con el ID exacto). Si no estás seguro o no aplica ninguna, omite la etiqueta.\n`;
      }

      // 2. Intentar buscar la campaña activa de esta conversación para inyectar sus tipificaciones
      if (contactData?.clienteNombre) {
        try {
          const { tenantId, clienteNombre, rut, telefono, direccion, plan, canal } = contactData;
          const contactId = await upsertContact({ tenantId, clienteNombre, rut, telefono, direccion, plan, canal });
          const { data: conv } = await supabase.from("conversations").select("campaign_id")
            .eq("tenant_id", tenantId).eq("contact_id", contactId).is("resumen_ejecutivo", null)
            .not("status", "in", "(closed,resolved,abandoned)").maybeSingle();
          if (conv?.campaign_id) activeCampaignId = conv.campaign_id;
        } catch (e) { console.error("[POST /api/chat] Error al buscar campaña actual:", e.message); }
      }

      if (activeCampaignId) {
        const { data: typs } = await supabase.from("campaign_typifications").select("label").eq("campaign_id", activeCampaignId).order("order_index", { ascending: true });
        if (typs && typs.length > 0) {
          finalSystemPrompt += `\nTIPIFICACIONES DE CIERRE DE ESTA CAMPAÑA:\n`;
          typs.forEach(t => {
            finalSystemPrompt += `- "${t.label}"\n`;
          });
          finalSystemPrompt += `\nINSTRUCCIÓN DE TIPIFICACIÓN: Si logras resolver completamente la solicitud del cliente por tu cuenta, debes marcar [ESTADO: finalizado] y OBLIGATORIAMENTE usar una de las tipificaciones anteriores en tu etiqueta [ACCION: ...]. Ejemplo: [ACCION: Venta Cerrada].\n`;
        }
      }
    }

    // 1. Llama a LLM
    const { text: finalPromptResponse } = await callLLM(supabase, {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      system: finalSystemPrompt,
      messages,
      max_tokens
    });

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
              .replace(/\[(ACCION|INTENCION|ESTADO|SENTIMIENTO|FUGA):.*?\]/gi, "").trim();
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
    // 1. Llama a LLM para generar el resumen
    const { text: resumenEjecutivo } = await callLLM(supabase, {
      provider: 'anthropic',
      model: 'claude-haiku-4-5-20251001',
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });

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
        const { data: conv, error: findErr } = await supabase
          .from("conversations")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("contact_id", contactId)
          .is("resumen_ejecutivo", null)
          .maybeSingle();

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
// Body: { tenantId, email, password, role, display_name }
app.post("/api/admin/users", async (req, res) => {
  const { tenantId, email, password, role = 'agent', display_name = '' } = req.body;

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
        display_name: display_name
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
// Actualiza un usuario (rol, contraseña, estado activo, nombre)
app.put("/api/admin/users/:userId", async (req, res) => {
  const { userId } = req.params;
  const { password, role, is_active, display_name } = req.body;

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
        campaign_id,
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
    const { data, error } = await supabase.from("campaign_typifications").select("*").eq("campaign_id", req.params.id);
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

// ─── POST /api/crm/conversations/:id/messages ─────────────────────────────────
// Ejecutivo envía mensaje o nota interna
// Body: { tenantId, userId, displayName, content, isInternalNote }
app.post("/api/crm/conversations/:id/messages", async (req, res) => {
  const { id } = req.params;
  const { tenantId, userId, displayName, content, isInternalNote = false } = req.body;
  if (!content) return res.status(400).json({ error: "content requerido." });
  try {
    const now = new Date().toISOString();
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
        const { data: profile } = await supabase.from("ai_profiles").select("persona_prompt, llm_provider, llm_model").eq("id", campaign.ai_profile_id).maybeSingle();
        if (profile) {
          if (profile.persona_prompt) systemPromptBase = profile.persona_prompt;
          if (profile.llm_provider) llmProvider = profile.llm_provider;
          if (profile.llm_model) llmModel = profile.llm_model;
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
    const rutMatch = content.match(/\b\d{7,8}-[\dkK]\b/);
    if (rutMatch || existingConv?.contact_id) {
      let contactData = null;
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

    let aiResponseText = "Lo siento, estoy experimentando problemas técnicos.";
    try {
      const claudeMessages = history.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content }));
      const systemGreeting = history.find(m => m.role === "system")?.content;

      const { text, usage } = await callLLM(supabase, {
        provider: llmProvider,
        model: llmModel,
        system: systemPromptBase + crmContext + ragContext +
          (systemGreeting ? `\n\nEl asistente comenzó la conversación saludando con: "${systemGreeting}". Tenlo en cuenta para el contexto.` : "") +
          "\n\nInstrucción obligatoria: Analiza la conversación y añade un bloque [METADATOS] al final de tu respuesta indicando ESTADO (activo/esperando_humano/finalizada), SENTIMIENTO (muy_negativo/negativo/neutral/positivo/muy_positivo), FUGA (sin_riesgo/bajo/medio/alto), y ACCION (ninguna/agendar/venta). Si el usuario pide humano, pon ESTADO: esperando_humano. Si el usuario se despide o la conversación concluye, pon ESTADO: finalizada. Además, si a lo largo del chat el usuario indica sus datos personales, extrae y añade en el bloque de metadatos: NOMBRE (nombre completo o nombre), RUT, TELEFONO, DIRECCION. Ej: [NOMBRE: Juan Pérez][TELEFONO: +569...].",
        messages: claudeMessages,
        max_tokens: 1024
      });
      aiResponseText = text;

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
    if (contactId) updateFields.contact_id = contactId;

    console.log("AI Raw text:", aiResponseText);
    console.log("AI Parsed metadata:", metadata);

    await supabase.from("conversations").update(updateFields).eq("id", convId);

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

// Fin de Widget Endpoints
app.listen(PORT, '0.0.0.0', () => console.log(`KUDEN IA Backend en http://0.0.0.0:${PORT}`));
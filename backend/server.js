import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
const HOST = "0.0.0.0";

app.use(helmet());
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",");
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("CORS bloqueado: " + origin));
  },
  methods: ["POST","GET"],
}));
app.use(express.json({ limit: "20kb" }));
const limiter = rateLimit({ windowMs: 60000, max: 60, message: { error: "Demasiadas solicitudes." } });
app.use("/api/", limiter);

if (!process.env.ANTHROPIC_API_KEY) { console.error("Falta ANTHROPIC_API_KEY en .env"); process.exit(1); }

app.post("/api/chat", async (req, res) => {
  const { system, messages, max_tokens } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: "messages requerido." });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: max_tokens || 1000, system, messages }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message });
    return res.json(data);
  } catch (e) { console.error(e); return res.status(500).json({ error: "Error interno." }); }
});

app.post("/api/summarize", async (req, res) => {
  const { clienteNombre, plan, canal, motivoLabel, conversacion } = req.body;
  if (!conversacion) return res.status(400).json({ error: "conversacion requerido." });
  const prompt = "Genera resumen ejecutivo en 4 lineas: problema, acciones, resultado, recomendacion.\nCliente: " + clienteNombre + " | Plan: " + plan + " | Canal: " + canal + " | Cierre: " + motivoLabel + "\n\n" + conversacion;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message });
    return res.json(data);
  } catch (e) { return res.status(500).json({ error: "Error interno." }); }
});

app.get("/health", (_, res) => res.json({ status: "ok", service: "KUDEN IA Backend" }));
app.use((_, res) => res.status(404).json({ error: "Ruta no encontrada." }));
app.listen(PORT, HOST, () => console.log("KUDEN IA Backend en http://" + HOST + ":" + PORT));
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
export async function sendChatMessage({ system, messages, model="claude-sonnet-4-20250514", max_tokens=1000 }) {
  const res = await fetch(`${API_BASE}/api/chat`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({model,max_tokens,system,messages}) });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error||"Error "+res.status); }
  return res.json();
}
export async function summarizeCase({ clienteNombre, plan, canal, motivoLabel, conversacion }) {
  const res = await fetch(`${API_BASE}/api/summarize`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({clienteNombre,plan,canal,motivoLabel,conversacion}) });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error||"Error "+res.status); }
  return res.json();
}

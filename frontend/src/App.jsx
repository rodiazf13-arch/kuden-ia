import KudenSimulator from "./simulator/KudenSimulator.jsx";
export default function App() {
  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 1rem" }}>
      <header style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 0", borderBottom:"0.5px solid #e5e7eb", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", background:"#1D9E75", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ color:"#fff", fontWeight:700, fontSize:16 }}>K</span>
          </div>
          <div>
            <p style={{ margin:0, fontWeight:600, fontSize:15, color:"#111" }}>KUDEN IA</p>
            <p style={{ margin:0, fontSize:11, color:"#6b7280" }}>Simulador de Agente Virtual</p>
          </div>
        </div>
        <span style={{ fontSize:11, background:"#E1F5EE", color:"#085041", borderRadius:20, padding:"3px 10px", fontWeight:500 }}>Demo</span>
      </header>
      <KudenSimulator />
      <footer style={{ textAlign:"center", padding:"16px 0", borderTop:"0.5px solid #e5e7eb", marginTop:16 }}>
        <p style={{ margin:0, fontSize:11, color:"#9ca3af" }}>KUDEN IA © 2026</p>
      </footer>
    </div>
  );
}

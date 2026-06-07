import KudenSimulator from "./simulator/KudenSimulator.jsx";
export default function App() {
  return (
    <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 1rem", fontFamily:'"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <header style={{ position:"sticky", top:0, zIndex:50, background:"#fff", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 0", borderBottom:"0.5px solid #E1EDF3", marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:"50%", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid #D2E5ED", overflow:"hidden" }}>
            <img src="/kuden-logo.png" alt="KUDEN" style={{ width:26, height:26, objectFit:"contain" }}/>
          </div>
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:15, color:"#0E2A3A", fontFamily:'"Bricolage Grotesque", sans-serif' }}>KUDEN IA</p>
            <p style={{ margin:0, fontSize:11, color:"#6E8794" }}>Simulador de Agente Virtual</p>
          </div>
        </div>
      </header>
      <KudenSimulator />
      <footer style={{ textAlign:"center", padding:"16px 0", borderTop:"0.5px solid #E1EDF3", marginTop:16 }}>
        <p style={{ margin:0, fontSize:11, color:"#9ca3af" }}>KUDEN IA © 2026</p>
      </footer>
    </div>
  );
}

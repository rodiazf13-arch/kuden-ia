/* ==========================================================================
   KIMI AI WIDGET — PAQUETE MODULAR AUTÓNOMO (kimi-widget.js)
   Para usar en cualquier proyecto web de Kuden (Kuden IA / Kuden QA):
   1. Incluye <link rel="stylesheet" href="kimi-widget.css">
   2. Incluye <script src="kimi-widget.js"></script>
   ========================================================================== */

(function () {
  'use strict';

  // Diálogos dinámicos para cada uno de los 7 estados
  const KIMI_MESSAGES = {
    idle: "¡Hola! Soy Kimi 🤖✨. Estoy vigilando el 100% de tus operaciones en segundo plano. Haz clic en los botones para ver mis estados.",
    listening: "🎧 Escuchando interacción en vivo... Transcribiendo canal telefónico e identificando sentimiento del cliente.",
    thinking: "⚡ Analizando pauta de calidad y cruzando métricas con CRM... Redactando datos PII/PCI en la bóveda.",
    speaking: "📢 Asistiendo al ejecutivo en tiempo real: sugiriendo el mejor argumento comercial para cerrar la venta.",
    success: "✨ ¡Auditoría 100% exitosa! Cumplimiento normativo validado y hallazgo convertido en quiz de Kimi Academy.",
    handoff: "🔄 Transfiriendo sesión a ejecutivo especialista humano con todo el contexto y resumen de IA sin fricción.",
    sleep: "🌙 Modo ahorro de energía activado. Sincronizando lotes nocturnos por SFTP y S3 a las 02:00 AM."
  };

  function initKimiWidget() {
    if (document.getElementById('kimi-widget-wrap')) return; // Evitar duplicados

    const widgetHTML = `
      <div id="kimi-widget-wrap" class="kimi-widget-wrap">
        <!-- Panel de control interactivo -->
        <div id="kimi-panel" class="kimi-panel">
          <div class="kimi-panel-header">
            <div class="kimi-panel-title">
              <span class="kimi-status-dot"></span>
              <span>Kimi Co-Piloto AI</span>
            </div>
            <button id="kimi-close-btn" class="kimi-close-btn" title="Cerrar panel">✕</button>
          </div>

          <div id="kimi-dialogue" class="kimi-dialogue">
            ${KIMI_MESSAGES.idle}
          </div>

          <div class="kimi-states-label">Probar Estados de Kimi:</div>
          <div class="kimi-state-buttons">
            <button class="kimi-btn-state active" data-state="idle">🌟 Idle</button>
            <button class="kimi-btn-state" data-state="listening">🎧 Listening</button>
            <button class="kimi-btn-state" data-state="thinking">⚡ Thinking</button>
            <button class="kimi-btn-state" data-state="speaking">📢 Speaking</button>
            <button class="kimi-btn-state" data-state="success">✨ Success</button>
            <button class="kimi-btn-state" data-state="handoff">🔄 Handoff</button>
            <button class="kimi-btn-state" data-state="sleep">🌙 Sleep</button>
          </div>
        </div>

        <!-- Mascota Kimi animada con satélites y aura pulsante -->
        <div id="kimi-avatar" class="kimi idle" title="¡Haz clic en Kimi para interactuar!">
          <div class="kimi-orbit orbit-outer"><span class="kimi-sat sat-1"></span></div>
          <div class="kimi-orbit orbit-inner"><span class="kimi-sat sat-2"></span></div>
          <img src="assets/kimi.png" alt="Kimi AI Mascot">
        </div>
      </div>
    `;

    // Inyectar al final del body
    const div = document.createElement('div');
    div.innerHTML = widgetHTML;
    document.body.appendChild(div.firstElementChild);

    // Eventos
    const kimiAvatar = document.getElementById('kimi-avatar');
    const kimiPanel = document.getElementById('kimi-panel');
    const kimiCloseBtn = document.getElementById('kimi-close-btn');
    const kimiDialogue = document.getElementById('kimi-dialogue');
    const stateButtons = document.querySelectorAll('.kimi-btn-state');

    // Alternar panel al hacer clic en la mascota
    kimiAvatar.addEventListener('click', function () {
      kimiPanel.classList.toggle('active');
    });

    // Cerrar panel con el botón X
    kimiCloseBtn.addEventListener('click', function () {
      kimiPanel.classList.remove('active');
    });

    // Cambiar estados al hacer clic en los botones
    stateButtons.forEach(btn => {
      btn.addEventListener('click', function () {
        const state = this.getAttribute('data-state');

        // Actualizar clase del contenedor de Kimi según especificación del usuario
        kimiAvatar.className = 'kimi ' + state;

        // Actualizar botones activos
        stateButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Actualizar mensaje de diálogo
        if (KIMI_MESSAGES[state]) {
          kimiDialogue.textContent = KIMI_MESSAGES[state];
        }
      });
    });
  }

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKimiWidget);
  } else {
    initKimiWidget();
  }
})();

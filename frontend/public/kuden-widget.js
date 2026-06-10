(function() {
  // 1. Obtener la configuración
  const initConfig = window.KudenWidgetInit || {};
  let tenantId = initConfig.tenantId;
  let widgetId = initConfig.widgetId || null;
  let API_URL = initConfig.apiUrl || "http://127.0.0.1:3001";

  // Fallback a script tag (modo antiguo)
  if (!tenantId) {
    const scriptTag = document.currentScript || document.querySelector('script[src*="kuden-widget.js"]');
    if (scriptTag) {
      tenantId = scriptTag.getAttribute('data-tenant');
    }
  }

  if (!tenantId) {
    console.error("KUDEN WIDGET: Falta tenantId en la inicialización o en el script.");
    return;
  }
  
  let sessionId = localStorage.getItem(`kuden_session_${tenantId}`) || null;
  let widgetConfig = { color: '#2563eb', mode: 'chat_only', name: 'Soporte', welcome_message: '¡Hola! ¿En qué te puedo ayudar hoy?' };
  let isOpen = false;
  let messages = [];
  let knownMessageIds = new Set();  // track rendered messages to avoid duplication
  let csatShown = false;            // track if CSAT was already shown (persists across polls)
  let csatDone = false;             // track if user already rated (don't show again)

  // 2. Inyectar CSS
  const style = document.createElement('style');
  style.innerHTML = `
    .kuden-widget-btn {
      position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px;
      border-radius: 50%; background-color: var(--kuden-color, #2563eb);
      color: white; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); cursor: pointer; z-index: 999999;
      transition: transform 0.2s; border: none; outline: none;
    }
    .kuden-widget-btn:hover { transform: scale(1.05); }
    .kuden-widget-btn svg { width: 30px; height: 30px; fill: currentColor; }
    
    .kuden-widget-window {
      position: fixed; bottom: 90px; right: 20px; width: 350px; height: 500px;
      background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      display: none; flex-direction: column; overflow: hidden; z-index: 999999;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .kuden-widget-window.open { display: flex; }
    
    .kuden-widget-header {
      background-color: var(--kuden-color, #2563eb); color: white; padding: 16px;
      font-weight: bold; display: flex; justify-content: space-between; align-items: center;
      flex-shrink: 0;
    }
    .kuden-widget-close { background: none; border: none; color: white; cursor: pointer; font-size: 20px; }
    
    .kuden-widget-body {
      flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
      background-color: #f9fafb;
    }
    .kuden-msg { max-width: 85%; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.4; }
    .kuden-msg.ai, .kuden-msg.system, .kuden-msg.human_agent { background: #e5e7eb; color: #111827; align-self: flex-start; border-bottom-left-radius: 2px; }
    .kuden-msg.customer { background: var(--kuden-color, #2563eb); color: white; align-self: flex-end; border-bottom-right-radius: 2px; }
    .kuden-msg.system { font-style: italic; background: #fef08a; font-size: 12px; text-align: center; align-self: center; }
    
    .kuden-widget-footer {
      padding: 12px; background: white; border-top: 1px solid #e5e7eb; display: flex; gap: 8px;
      flex-shrink: 0;
    }
    .kuden-widget-input {
      flex: 1; padding: 10px; border: 1px solid #d1d5db; border-radius: 20px; outline: none; font-family: inherit;
    }
    .kuden-widget-input:focus { border-color: var(--kuden-color, #2563eb); }
    .kuden-widget-send {
      background: var(--kuden-color, #2563eb); color: white; border: none; border-radius: 50%;
      width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .kuden-widget-send svg { width: 18px; height: 18px; fill: currentColor; }
    .kuden-widget-send:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .kuden-typing { font-size: 12px; color: #6b7280; margin: 0 16px 8px; display: none; flex-shrink: 0; }
    .kuden-typing.active { display: block; }
    
    .kuden-stars { display: flex; gap: 8px; justify-content: center; margin-top: 10px; }
    .kuden-star { cursor: pointer; font-size: 32px; color: #d1d5db; transition: color 0.15s; }
    .kuden-star.hover, .kuden-star.selected { color: #fbbf24; }
    .kuden-csat-container { background: white; padding: 16px; border-radius: 12px; border: 1px solid #e5e7eb; text-align: center; margin: 4px 0; align-self: stretch; }
    .kuden-csat-title { font-weight: 600; font-size: 14px; color: #374151; margin-bottom: 10px; }
    .kuden-csat-done { font-size: 14px; color: #1D9E75; font-weight: 600; }
  `;
  document.head.appendChild(style);

  // 3. Crear UI
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="kuden-widget-window" id="kw-window">
      <div class="kuden-widget-header">
        <span id="kw-title">Soporte IA</span>
        <button class="kuden-widget-close" id="kw-close">&times;</button>
      </div>
      <div class="kuden-widget-body" id="kw-body">
        <div class="kuden-msg ai" id="kw-welcome-msg">¡Hola! ¿En qué te puedo ayudar hoy?</div>
      </div>
      <div class="kuden-typing" id="kw-typing">Escribiendo...</div>
      <div class="kuden-widget-footer">
        <input type="text" class="kuden-widget-input" id="kw-input" placeholder="Escribe tu mensaje..." autocomplete="off">
        <button class="kuden-widget-send" id="kw-send">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
    <button class="kuden-widget-btn" id="kw-btn">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </button>
  `;
  document.body.appendChild(container);

  const kwWindow = document.getElementById('kw-window');
  const kwBtn = document.getElementById('kw-btn');
  const kwClose = document.getElementById('kw-close');
  const kwInput = document.getElementById('kw-input');
  const kwSend = document.getElementById('kw-send');
  const kwBody = document.getElementById('kw-body');
  const kwTitle = document.getElementById('kw-title');
  const kwTyping = document.getElementById('kw-typing');

  // 4. Funciones
  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      kwWindow.classList.add('open');
      kwBtn.style.display = 'none';
      kwInput.focus();
      if (sessionId && messages.length === 0) fetchMessages();
    } else {
      kwWindow.classList.remove('open');
      kwBtn.style.display = 'flex';
    }
  }

  function scrollToBottom() {
    kwBody.scrollTop = kwBody.scrollHeight;
  }

  // Append only NEW messages that we haven't rendered yet (preserves CSAT and other UI elements)
  function appendNewMessages(msgs) {
    let appended = false;
    msgs.forEach(m => {
      if (knownMessageIds.has(m.id)) return;
      knownMessageIds.add(m.id);
      const div = document.createElement('div');
      div.className = `kuden-msg ${m.sender_type}`;
      div.dataset.msgId = m.id;
      div.innerText = m.content;
      // Insert before the CSAT container if it exists, otherwise append
      const csatEl = kwBody.querySelector('.kuden-csat-container');
      if (csatEl) kwBody.insertBefore(div, csatEl);
      else kwBody.appendChild(div);
      appended = true;
    });
    if (appended) scrollToBottom();
  }

  async function init() {
    try {
      const url = new URL(`${API_URL}/api/widget/config`);
      url.searchParams.append('tenantId', tenantId);
      if (widgetId) url.searchParams.append('widgetId', widgetId);

      const res = await fetch(url.toString());
      const config = await res.json();
      
      if (config.color) document.documentElement.style.setProperty('--kuden-color', config.color);
      if (config.name) kwTitle.innerText = config.name;
      if (config.welcome_message) {
        const welcomeEl = document.getElementById('kw-welcome-msg');
        if (welcomeEl) welcomeEl.innerText = config.welcome_message;
      }
    } catch (e) {
      console.error("Kuden Widget Init Error:", e);
    }
  }

  async function sendMessage() {
    const text = kwInput.value.trim();
    if (!text || csatDone) return;

    kwInput.value = '';
    
    // Optimistic render of customer message
    const tempDiv = document.createElement('div');
    tempDiv.className = 'kuden-msg customer optimistic-msg';
    tempDiv.innerText = text;
    kwBody.appendChild(tempDiv);
    scrollToBottom();
    
    kwTyping.classList.add('active');

    try {
      const payload = { tenantId, conversationId: sessionId, content: text };
      if (widgetId) payload.widgetId = widgetId;

      const res = await fetch(`${API_URL}/api/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.conversationId && !sessionId) {
        sessionId = data.conversationId;
        localStorage.setItem(`kuden_session_${tenantId}`, sessionId);
      }

      // Fetch real messages from backend (replaces optimistic message via deduplication)
      await fetchMessages();

      // Show CSAT only once, if flagged and not already shown
      if (data.needsCsat && !csatShown && !csatDone) {
        csatShown = true;
        renderCsatUI();
      }
    } catch (e) {
      console.error("Error sending message:", e);
    } finally {
      kwTyping.classList.remove('active');
    }
  }

  async function fetchMessages() {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_URL}/api/widget/chat/${sessionId}`);
      const data = await res.json();

      let msgs = [];
      let status = 'active';
      let csatFinal = null;

      if (data && typeof data === 'object' && !Array.isArray(data)) {
        msgs = data.messages || [];
        status = data.status || 'active';
        csatFinal = data.csat_final;
      } else if (Array.isArray(data)) {
        msgs = data;
      }

      if (msgs.length > 0) {
        // Remover mensajes optimistas antes de cargar los reales de la base de datos
        const optimistics = kwBody.querySelectorAll('.optimistic-msg');
        optimistics.forEach(el => el.remove());

        messages = msgs;
        appendNewMessages(messages);  // Only append NEW messages, never wipe existing UI
      }

      // Sincronizar estado de CSAT de la conversación
      const isPending = status === 'pending_csat';
      const isClosed = status === 'closed' || status === 'resolved';

      if (isPending && !csatFinal && !csatShown && !csatDone) {
        csatShown = true;
        renderCsatUI();
      } else if (csatFinal || isClosed) {
        if (!csatDone) {
          csatDone = true;
          // Si el panel de CSAT existe en pantalla, mostrar agradecimiento
          const csatEl = kwBody.querySelector('.kuden-csat-container');
          if (csatEl) {
            csatEl.innerHTML = '<div class="kuden-csat-done">⭐ ¡Gracias por tu calificación!</div>';
          }
          kwInput.disabled = true;
          kwSend.disabled = true;
          kwInput.placeholder = "Conversación finalizada";
        }
      }
    } catch (e) {
      console.error("Error polling messages:", e);
    }
  }

  function renderCsatUI() {
    if (csatDone) return;
    if (kwBody.querySelector('.kuden-csat-container')) return; // Evita duplicar el contenedor CSAT
    const csatDiv = document.createElement('div');
    csatDiv.className = 'kuden-csat-container';
    csatDiv.id = 'kuden-csat';
    csatDiv.innerHTML = `
      <div class="kuden-csat-title">¿Qué te pareció nuestra atención?</div>
      <div class="kuden-stars" id="kuden-stars">
        <span class="kuden-star" data-score="1">★</span>
        <span class="kuden-star" data-score="2">★</span>
        <span class="kuden-star" data-score="3">★</span>
        <span class="kuden-star" data-score="4">★</span>
        <span class="kuden-star" data-score="5">★</span>
      </div>
    `;
    kwBody.appendChild(csatDiv);
    scrollToBottom();

    const stars = csatDiv.querySelectorAll('.kuden-star');
    const starsContainer = csatDiv.querySelector('#kuden-stars');

    stars.forEach(star => {
      star.addEventListener('click', async () => {
        if (csatDone) return;
        csatDone = true;
        const score = star.getAttribute('data-score');
        // Show thanks
        csatDiv.innerHTML = '<div class="kuden-csat-done">⭐ ¡Gracias por tu calificación!</div>';
        kwInput.disabled = true;
        kwSend.disabled = true;
        kwInput.placeholder = "Conversación finalizada";
        try {
          await fetch(`${API_URL}/api/widget/csat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, conversationId: sessionId, score })
          });
        } catch(e) { console.error("Error CSAT", e); }
      });
    });

    // Hover effects using event delegation
    starsContainer.addEventListener('mouseover', (e) => {
      const star = e.target.closest('.kuden-star');
      if (!star) return;
      const hovered = parseInt(star.getAttribute('data-score'));
      stars.forEach(st => {
        if (parseInt(st.getAttribute('data-score')) <= hovered) st.classList.add('hover');
        else st.classList.remove('hover');
      });
    });
    starsContainer.addEventListener('mouseleave', () => {
      stars.forEach(st => st.classList.remove('hover'));
    });
  }

  // 5. Eventos y Polling
  kwBtn.addEventListener('click', toggleChat);
  kwClose.addEventListener('click', toggleChat);
  kwSend.addEventListener('click', sendMessage);
  kwInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Polling: Only appends new messages, never wipes existing content (CSAT safe)
  setInterval(() => {
    if (isOpen && sessionId && !csatDone) {
      fetchMessages();
    }
  }, 5000);

  // Iniciar
  init();

})();

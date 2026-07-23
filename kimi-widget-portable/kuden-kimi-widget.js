const KIMI_VERSION = '1.0.0';

const VALID_STATES = Object.freeze([
  'idle',
  'thinking',
  'success',
  'walking',
  'spinning',
  'pulse',
  'curious',
  'sleeping'
]);

const DEFAULT_COPY = Object.freeze({
  idle: {
    title: '¡Hola! Soy Kimi.',
    message: 'Estoy disponible para acompañarte.'
  },
  thinking: {
    title: 'Estoy analizando.',
    message: 'Cruzo contexto y datos para preparar la mejor respuesta.'
  },
  success: {
    title: '¡Listo!',
    message: 'La tarea terminó correctamente.'
  },
  walking: {
    title: 'En movimiento.',
    message: 'Estoy recorriendo la operación y revisando nuevas señales.'
  },
  spinning: {
    title: 'Cambiando de módulo.',
    message: 'Conecto la información necesaria para continuar.'
  },
  pulse: {
    title: 'Kuden conectado.',
    message: 'El ecosistema está activo y sincronizado.'
  },
  curious: {
    title: 'Encontré algo interesante.',
    message: 'Estoy inspeccionando este resultado con más detalle.'
  },
  sleeping: {
    title: 'Modo de reposo.',
    message: 'Seguiré aquí cuando vuelvas a necesitarme.'
  }
});

let instanceCounter = 0;
const HTMLElementBase = globalThis.HTMLElement || class {};

function parseBooleanAttribute(element, name, defaultValue = false) {
  if (!element.hasAttribute(name)) return defaultValue;
  return element.getAttribute(name) !== 'false';
}

function normaliseState(value) {
  return VALID_STATES.includes(value) ? value : 'idle';
}

export class KudenKimiWidget extends HTMLElementBase {
  static get version() {
    return KIMI_VERSION;
  }

  static get states() {
    return [...VALID_STATES];
  }

  static get observedAttributes() {
    return [
      'state',
      'product',
      'bubble-title',
      'message',
      'position',
      'theme',
      'size',
      'closable',
      'auto-cycle',
      'cycle-interval',
      'cycle-states',
      'hide-bubble',
      'minimized'
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._uid = `kimi-${++instanceCounter}`;
    this._timer = 0;
    this._typingTimer = 0;
    this._typingToken = 0;
    this._nextStateSource = '';
    this._rendered = false;
    this._onVisibilityChange = () => this._scheduleCycle();
  }

  connectedCallback() {
    if (!this.hasAttribute('state')) this.setAttribute('state', 'idle');
    if (!this.hasAttribute('position')) this.setAttribute('position', 'right');
    if (!this.hasAttribute('theme')) this.setAttribute('theme', 'auto');
    if (!this.hasAttribute('size')) this.setAttribute('size', 'medium');
    if (!this._rendered) this._render();
    this._syncAll();
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    this._scheduleCycle();
  }

  disconnectedCallback() {
    window.clearTimeout(this._timer);
    window.clearTimeout(this._typingTimer);
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this._rendered) return;

    if (name === 'state') {
      const source = this._nextStateSource || 'attribute';
      this._nextStateSource = '';
      this._applyState(source, true);
      this._scheduleCycle();
      return;
    }

    this._syncConfiguration();
    if (name === 'bubble-title' || name === 'message' || name === 'product') {
      this._applyCopy('attribute');
    }
    if (name === 'auto-cycle' || name === 'cycle-interval' || name === 'cycle-states' || name === 'minimized') {
      this._scheduleCycle();
    }
  }

  get state() {
    return normaliseState(this.getAttribute('state'));
  }

  set state(value) {
    this.setState(value);
  }

  get minimized() {
    return this.hasAttribute('minimized');
  }

  set minimized(value) {
    value ? this.hide() : this.show();
  }

  setState(state, options = {}) {
    const nextState = normaliseState(state);
    if (Object.prototype.hasOwnProperty.call(options, 'title')) this.setAttribute('bubble-title', String(options.title));
    if (Object.prototype.hasOwnProperty.call(options, 'message')) this.setAttribute('message', String(options.message));
    const source = options.source || 'api';
    this._setState(nextState, source);
    return this;
  }

  setMessage(title, message) {
    this.setAttribute('bubble-title', String(title ?? ''));
    this.setAttribute('message', String(message ?? ''));
    return this;
  }

  useDefaultMessage() {
    this.removeAttribute('bubble-title');
    this.removeAttribute('message');
    this._applyCopy('api');
    return this;
  }

  speak(title, message, options = {}) {
    const speed = Math.max(10, Number(options.speed) || 28);
    const text = String(message ?? '');
    const token = ++this._typingToken;
    window.clearTimeout(this._typingTimer);
    this._els.live.setAttribute('aria-live', options.announce === false ? 'off' : 'polite');
    this._els.title.textContent = String(title ?? '');
    this._els.message.textContent = '';
    this._els.panel.classList.add('is-talking');

    return new Promise((resolve) => {
      let index = 0;
      const typeNext = () => {
        if (token !== this._typingToken) return resolve(false);
        if (index >= text.length) {
          this._els.panel.classList.remove('is-talking');
          this._restoreLiveRegion();
          resolve(true);
          return;
        }
        this._els.message.textContent += text[index++];
        this._typingTimer = window.setTimeout(typeNext, speed);
      };
      typeNext();
    });
  }

  show() {
    if (!this.hasAttribute('minimized')) return this;
    this.removeAttribute('minimized');
    this._els.mascot.focus({ preventScroll: true });
    this._dispatch('kimi-restore', { state: this.state });
    return this;
  }

  hide() {
    if (this.hasAttribute('minimized')) return this;
    this.setAttribute('minimized', '');
    this._els.launcher.focus({ preventScroll: true });
    this._dispatch('kimi-minimize', { state: this.state });
    return this;
  }

  toggle() {
    return this.minimized ? this.show() : this.hide();
  }

  advance(source = 'api') {
    const states = this._cycleStates();
    const index = states.indexOf(this.state);
    const next = states[(index + 1 + states.length) % states.length];
    this._setState(next, source);
    return this;
  }

  _setState(state, source) {
    const nextState = normaliseState(state);
    this._nextStateSource = source;
    if (this.getAttribute('state') === nextState) {
      this._nextStateSource = '';
      this._applyState(source, true);
    } else {
      this.setAttribute('state', nextState);
    }
  }

  _render() {
    const bodyShade = `${this._uid}-body-shade`;
    const indigo = `${this._uid}-indigo`;
    const floorShadow = `${this._uid}-floor-shadow`;
    const sprout = `${this._uid}-sprout`;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --kimi-size: 140px;
          --kimi-offset-x: 24px;
          --kimi-offset-y: 24px;
          --kimi-z-index: 99990;
          --kimi-accent: #635bff;
          --kimi-accent-bright: #7e5cff;
          --kimi-cyan: #37d7ff;
          --kimi-title: #101828;
          --kimi-text: #4d5366;
          --kimi-muted: #667085;
          --kimi-bubble: rgba(255, 255, 255, .96);
          --kimi-border: rgba(99, 91, 255, .16);
          --kimi-shadow: 0 22px 58px rgba(42, 38, 95, .22);
          position: fixed;
          right: var(--kimi-offset-x);
          bottom: var(--kimi-offset-y);
          z-index: var(--kimi-z-index);
          display: block;
          width: var(--kimi-size);
          height: var(--kimi-size);
          color: var(--kimi-title);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          contain: layout style;
          isolation: isolate;
        }

        :host([position="left"]) {
          right: auto;
          left: var(--kimi-offset-x);
        }

        :host([size="small"]) { --kimi-size: 112px; }
        :host([size="large"]) { --kimi-size: 170px; }

        :host([theme="dark"]) {
          --kimi-title: #fff;
          --kimi-text: #c5cada;
          --kimi-muted: #9ca5bd;
          --kimi-bubble: rgba(24, 29, 49, .96);
          --kimi-border: rgba(255, 255, 255, .12);
          --kimi-shadow: 0 24px 64px rgba(0, 0, 0, .48);
        }

        @media (prefers-color-scheme: dark) {
          :host([theme="auto"]) {
            --kimi-title: #fff;
            --kimi-text: #c5cada;
            --kimi-muted: #9ca5bd;
            --kimi-bubble: rgba(24, 29, 49, .96);
            --kimi-border: rgba(255, 255, 255, .12);
            --kimi-shadow: 0 24px 64px rgba(0, 0, 0, .48);
          }
        }

        *, *::before, *::after { box-sizing: border-box; }
        button { font: inherit; }

        .panel {
          position: absolute;
          inset: 0;
          transform: scale(1) rotate(0);
          opacity: 1;
          transition: transform .45s cubic-bezier(.34, 1.56, .64, 1), opacity .25s ease;
        }

        :host([minimized]) .panel {
          transform: scale(0) rotate(-22deg);
          opacity: 0;
          pointer-events: none;
        }

        .mascot {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          padding: 0;
          overflow: visible;
          border: 0;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(55, 215, 255, .14), rgba(99, 91, 255, .08) 58%, transparent 74%);
          cursor: pointer;
          perspective: 900px;
          transform-style: preserve-3d;
          -webkit-tap-highlight-color: transparent;
        }

        .mascot::before,
        .mascot::after {
          content: "";
          position: absolute;
          z-index: 0;
          border-radius: 50%;
          opacity: .65;
          pointer-events: none;
        }

        .mascot::before {
          inset: 8%;
          background: radial-gradient(circle, rgba(55, 215, 255, .22), transparent 70%);
          animation: aura-breathe 4.8s ease-in-out infinite;
        }

        .mascot::after {
          inset: -4%;
          border: 1px dashed rgba(126, 92, 255, .22);
          animation: orbit 16s linear infinite;
        }

        .mascot:focus-visible {
          outline: 3px solid rgba(55, 215, 255, .62);
          outline-offset: 4px;
        }

        .motion-shell {
          position: absolute;
          z-index: 2;
          inset: -1% 0 0;
          display: grid;
          place-items: center;
          transform-origin: 50% 70%;
          animation: breathe 4.8s ease-in-out infinite;
          will-change: transform, filter;
        }

        .kimi-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
          filter: drop-shadow(0 12px 18px rgba(99, 91, 255, .34));
        }

        .floor-shadow {
          transform-origin: 150px 305px;
          animation: shadow-breathe 4.8s ease-in-out infinite;
        }

        .eye-shine {
          transform-origin: center;
          animation: eye-sparkle 3.4s ease-in-out infinite;
        }

        .eyelid {
          opacity: 0;
          animation: blink 5.2s infinite;
        }

        .eyes-happy,
        .eyes-wink,
        .eyes-sleep,
        .eyes-thinking { display: none; }

        [data-state="thinking"] .eyes-normal,
        [data-state="success"] .eyes-normal,
        [data-state="curious"] .eyes-normal,
        [data-state="sleeping"] .eyes-normal { display: none; }

        [data-state="thinking"] .eyes-thinking,
        [data-state="success"] .eyes-happy,
        [data-state="curious"] .eyes-wink,
        [data-state="sleeping"] .eyes-sleep { display: block; }

        .right-arm {
          transform-box: view-box;
          transform-origin: 242px 188px;
        }

        .mouth { transform-origin: 150px 176px; }
        .is-talking .mouth { animation: talk .28s ease-in-out infinite alternate; }
        .mascot:hover .right-arm { animation: wave .7s ease-in-out infinite; }

        .sprout {
          transform-origin: 150px 45px;
          transition: transform .6s cubic-bezier(.34, 1.56, .64, 1);
        }

        .sprout-energy {
          opacity: 0;
          transform: scale(0);
          transform-origin: 149px 10px;
          transition: opacity .45s ease, transform .55s cubic-bezier(.34, 1.56, .64, 1);
        }

        [data-state="thinking"] .motion-shell { animation: thinking 2.2s ease-in-out infinite; }
        [data-state="thinking"] .sprout { animation: sprout-grow 2s ease-in-out infinite alternate; }
        [data-state="thinking"] .sprout > path {
          stroke: url(#${sprout});
          animation: sprout-glow 1.5s ease-in-out infinite alternate;
        }
        [data-state="thinking"] .sprout-energy { opacity: 1; transform: scale(1); }
        [data-state="thinking"] .energy-leaf,
        [data-state="thinking"] .energy-spark { animation: energy-pulse 1.6s ease-in-out infinite alternate; }

        .chest-logo,
        .chest-logo-pulse {
          transform-box: fill-box;
          transform-origin: center;
        }

        [data-state="success"] .motion-shell {
          animation: celebrate .85s cubic-bezier(.68, -.55, .265, 1.55) both,
                     breathe 4.8s ease-in-out .85s infinite;
        }
        [data-state="success"] .chest-logo-pulse,
        [data-state="pulse"] .chest-logo-pulse { animation: heartbeat 1.15s ease-in-out infinite; }
        [data-state="success"] .right-arm { animation: wave .7s ease-in-out 3; }
        [data-state="walking"] .motion-shell { animation: walking 1.4s ease-in-out infinite alternate; }
        [data-state="walking"] .right-arm { animation: wave .4s ease-in-out infinite alternate; }
        [data-state="spinning"] .motion-shell { animation: spinning 1s cubic-bezier(.45, .05, .55, .95) infinite; }
        [data-state="curious"] .motion-shell { animation: curious 2.2s ease-in-out infinite; }
        [data-state="curious"] .sprout { transform: rotate(20deg) scale(1.1); }
        [data-state="sleeping"] .motion-shell { animation: sleeping 3.5s ease-in-out infinite; }
        [data-state="sleeping"] .sleep-zzz { opacity: 1; }
        [data-state="sleeping"] .zzz-1 { animation: zzz 2.5s infinite ease-out 0s; }
        [data-state="sleeping"] .zzz-2 { animation: zzz 2.5s infinite ease-out .8s; }
        [data-state="sleeping"] .zzz-3 { animation: zzz 2.5s infinite ease-out 1.6s; }

        .spark {
          position: absolute;
          z-index: 4;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          opacity: .48;
          pointer-events: none;
          background: currentColor;
          box-shadow: 0 0 10px currentColor;
        }

        .spark-a { top: 15%; left: 8%; color: #00f0ff; animation: spark-a 5s ease-in-out infinite alternate; }
        .spark-b { top: 42%; right: 1%; color: #9d83ff; animation: spark-b 6.5s ease-in-out .5s infinite alternate; }
        .spark-c { bottom: 10%; left: 12%; color: #37d7ff; animation: spark-a 7.5s ease-in-out 1s infinite alternate; }
        .spark-d { right: 8%; bottom: 20%; color: #7e5cff; animation: spark-b 5.8s ease-in-out 1.5s infinite alternate; }
        [data-state="thinking"] .spark,
        [data-state="success"] .spark,
        .mascot:hover .spark { opacity: .95; }

        .bubble {
          position: absolute;
          z-index: 6;
          top: 10px;
          right: calc(100% - 10px);
          width: min(230px, calc(100vw - var(--kimi-size) - 54px));
          min-width: 190px;
          padding: 13px 15px;
          border: 1px solid var(--kimi-border);
          border-radius: 17px;
          color: var(--kimi-title);
          background: var(--kimi-bubble);
          box-shadow: var(--kimi-shadow);
          backdrop-filter: blur(18px) saturate(135%);
          -webkit-backdrop-filter: blur(18px) saturate(135%);
          animation: bubble-float 4s ease-in-out infinite;
          transition: opacity .25s ease, transform .3s ease;
        }

        :host([position="left"]) .bubble {
          right: auto;
          left: calc(100% - 10px);
        }

        :host([hide-bubble]) .bubble {
          opacity: 0;
          transform: scale(.92);
          pointer-events: none;
        }

        .bubble::after {
          content: "";
          position: absolute;
          top: 37px;
          right: -11px;
          border-top: 9px solid transparent;
          border-bottom: 9px solid transparent;
          border-left: 11px solid var(--kimi-bubble);
        }

        :host([position="left"]) .bubble::after {
          right: auto;
          left: -11px;
          border-right: 11px solid var(--kimi-bubble);
          border-left: 0;
        }

        .product,
        .title,
        .message { display: block; }

        .product {
          margin-bottom: 5px;
          color: var(--kimi-accent);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .title {
          color: var(--kimi-title);
          font-size: 14px;
          font-weight: 800;
          line-height: 1.25;
        }

        .message {
          margin: 5px 0 0;
          color: var(--kimi-text);
          font-size: 11.5px;
          font-weight: 560;
          line-height: 1.42;
        }

        .close {
          position: absolute;
          z-index: 8;
          top: 1px;
          right: 1px;
          display: grid;
          width: 25px;
          height: 25px;
          padding: 0;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, .24);
          border-radius: 50%;
          color: #fff;
          background: #15192b;
          box-shadow: 0 4px 12px rgba(0, 0, 0, .28);
          cursor: pointer;
          font-size: 12px;
          font-weight: 800;
          line-height: 1;
        }

        .close:hover { background: #e64b61; transform: scale(1.08); }
        .close:focus-visible { outline: 3px solid rgba(55, 215, 255, .62); outline-offset: 3px; }
        :host([closable="false"]) .close { display: none; }

        .launcher {
          position: absolute;
          right: 0;
          bottom: 0;
          display: grid;
          width: 56px;
          height: 56px;
          padding: 6px;
          place-items: center;
          overflow: visible;
          border: 1px solid var(--kimi-border);
          border-radius: 50%;
          color: var(--kimi-title);
          background: var(--kimi-bubble);
          box-shadow: var(--kimi-shadow);
          cursor: pointer;
          opacity: 0;
          pointer-events: none;
          transform: scale(0) rotate(18deg);
          transition: transform .4s cubic-bezier(.34, 1.56, .64, 1), opacity .2s ease;
        }

        :host([position="left"]) .launcher { right: auto; left: 0; }

        :host([minimized]) .launcher {
          opacity: 1;
          pointer-events: auto;
          transform: scale(1) rotate(0);
        }

        .launcher:hover { transform: scale(1.08); }
        .launcher:focus-visible { outline: 3px solid rgba(55, 215, 255, .62); outline-offset: 3px; }
        .launcher svg { width: 100%; height: 100%; overflow: visible; }

        .badge {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 10px;
          height: 10px;
          border: 2px solid var(--kimi-bubble);
          border-radius: 50%;
          background: #16d38a;
          box-shadow: 0 0 7px rgba(22, 211, 138, .85);
        }

        @keyframes breathe {
          0%, 100% { transform: translateY(2px) rotate(-1deg) scale(.97); }
          38% { transform: translateY(-7px) rotate(1.2deg) scale(1.015); }
          72% { transform: translateY(-2px) rotate(-.6deg) scale(.99); }
        }
        @keyframes thinking {
          0%, 100% { transform: translateY(1px) rotate(-2deg) scale(.98); filter: brightness(1); }
          50% { transform: translateY(-8px) rotate(2deg) scale(1.025); filter: brightness(1.08); }
        }
        @keyframes celebrate {
          0% { transform: scale(.82) rotate(0) translateY(0); }
          30% { transform: scale(1.12) rotate(-12deg) translateY(-14px); }
          58% { transform: scale(1.18) rotate(12deg) translateY(-18px); filter: brightness(1.25); }
          100% { transform: scale(1) rotate(0) translateY(0); }
        }
        @keyframes walking {
          from { transform: translateX(-14px) translateY(0) rotate(5deg); }
          to { transform: translateX(14px) translateY(-8px) rotate(-5deg); }
        }
        @keyframes spinning {
          from { transform: rotateY(0) scale(1); }
          50% { transform: rotateY(180deg) scale(.86); filter: drop-shadow(0 0 22px #00f0ff); }
          to { transform: rotateY(360deg) scale(1); }
        }
        @keyframes curious {
          0%, 100% { transform: rotate(-13deg) translateX(-8px); }
          50% { transform: rotate(13deg) translateX(8px) translateY(-4px); }
        }
        @keyframes sleeping {
          0%, 100% { transform: translateY(10px) scale(.96) rotate(3deg); }
          50% { transform: translateY(15px) scale(.95) rotate(-3deg); }
        }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 #7e5cff); }
          25% { transform: scale(1.28); filter: drop-shadow(0 0 12px #00f0ff); }
          42% { transform: scale(1.06); }
          62% { transform: scale(1.3); filter: drop-shadow(0 0 16px #00f0ff); }
        }
        @keyframes shadow-breathe {
          0%, 100% { transform: scaleX(1); opacity: .62; }
          38% { transform: scaleX(.78); opacity: .34; }
          72% { transform: scaleX(.9); opacity: .5; }
        }
        @keyframes eye-sparkle {
          0%, 76%, 100% { opacity: 1; transform: scale(1); }
          82% { opacity: .55; transform: scale(.72); }
          88% { opacity: 1; transform: scale(1.18); }
        }
        @keyframes blink {
          0%, 44%, 48%, 100% { opacity: 0; }
          45%, 47% { opacity: 1; }
        }
        @keyframes talk { from { transform: scaleY(.72); } to { transform: scaleY(1.25); } }
        @keyframes wave { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(24deg); } }
        @keyframes sprout-grow { from { transform: translateY(-4px) scale(1.04); } to { transform: translateY(-11px) scale(1.24) rotate(1.5deg); } }
        @keyframes sprout-glow { from { filter: drop-shadow(0 0 2px rgba(55, 215, 255, .4)); } to { filter: drop-shadow(0 0 8px rgba(55, 215, 255, .95)) drop-shadow(0 0 12px rgba(126, 92, 255, .65)); } }
        @keyframes energy-pulse { from { transform: scale(.86); opacity: .5; } to { transform: translateY(-4px) scale(1.14); opacity: 1; filter: drop-shadow(0 0 8px #37d7ff); } }
        @keyframes zzz { 0% { transform: translateY(0) scale(.6); opacity: 0; } 50% { opacity: 1; } 100% { transform: translate(20px, -36px) scale(1.2); opacity: 0; } }
        @keyframes aura-breathe { 0%, 100% { opacity: .48; transform: scale(.95); } 50% { opacity: .9; transform: scale(1.06); } }
        @keyframes orbit { to { transform: rotate(360deg); } }
        @keyframes bubble-float { 0%, 100% { translate: 0 0; } 50% { translate: 0 -6px; } }
        @keyframes spark-a { from { transform: scale(.8); } to { transform: translate(9px, -13px) scale(1.25); } }
        @keyframes spark-b { from { transform: scale(1.1); } to { transform: translate(-10px, 11px) scale(.72); } }

        @media (max-width: 620px) {
          :host {
            --kimi-size: 112px;
            --kimi-offset-x: 14px;
            --kimi-offset-y: 14px;
          }
          :host([size="large"]) { --kimi-size: 132px; }
          .bubble {
            top: -44px;
            right: -1px;
            width: min(220px, calc(100vw - 28px));
            min-width: 0;
            transform: translateY(-100%);
          }
          :host([position="left"]) .bubble {
            right: auto;
            left: -1px;
          }
          .bubble::after,
          :host([position="left"]) .bubble::after {
            top: auto;
            right: 34px;
            bottom: -10px;
            left: auto;
            border-top: 10px solid var(--kimi-bubble);
            border-right: 9px solid transparent;
            border-bottom: 0;
            border-left: 9px solid transparent;
          }
          :host([position="left"]) .bubble::after { right: auto; left: 34px; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .001ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .001ms !important;
          }
        }
      </style>

      <div class="panel" data-state="idle">
        <div class="bubble" part="bubble">
          <div class="live" role="status" aria-live="polite" aria-atomic="true">
            <span class="product"></span>
            <strong class="title"></strong>
            <p class="message"></p>
          </div>
        </div>

        <button class="close" type="button" aria-label="Minimizar a Kimi" title="Minimizar a Kimi">×</button>

        <button class="mascot" type="button" aria-label="Cambiar estado de Kimi" title="Cambiar estado de Kimi">
          <i class="spark spark-a"></i>
          <i class="spark spark-b"></i>
          <i class="spark spark-c"></i>
          <i class="spark spark-d"></i>
          <span class="motion-shell">
            <svg class="kimi-svg" viewBox="0 0 300 320" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <defs>
                <radialGradient id="${bodyShade}" cx="45%" cy="40%" r="60%">
                  <stop offset="0%" stop-color="#fff"/>
                  <stop offset="70%" stop-color="#e2e7f3"/>
                  <stop offset="100%" stop-color="#cbd3e6"/>
                </radialGradient>
                <linearGradient id="${indigo}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#7e5cff"/>
                  <stop offset="100%" stop-color="#635bff"/>
                </linearGradient>
                <radialGradient id="${floorShadow}" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#101828" stop-opacity=".35"/>
                  <stop offset="100%" stop-color="#101828" stop-opacity="0"/>
                </radialGradient>
                <linearGradient id="${sprout}" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stop-color="#7e5cff"/>
                  <stop offset="60%" stop-color="#00f0ff"/>
                  <stop offset="100%" stop-color="#37d7ff"/>
                </linearGradient>
              </defs>

              <ellipse class="floor-shadow" cx="150" cy="305" rx="68" ry="12" fill="url(#${floorShadow})"/>
              <path d="M90 170C65 175 60 210 82 220C87 215 90 200 92 190" stroke="url(#${indigo})" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M115 280C115 295 110 302 125 302C140 302 135 280 135 280" fill="url(#${indigo})"/>
              <path d="M165 280C165 295 160 302 175 302C190 302 185 280 185 280" fill="url(#${indigo})"/>
              <path d="M150 40C215 40 250 110 250 180C250 250 205 290 150 290C95 290 50 250 50 180C50 110 85 40 150 40Z" fill="url(#${bodyShade})"/>

              <g class="sprout">
                <path d="M142 45C138 25 125 15 132 8C140 0 148 20 146 42" stroke="url(#${indigo})" stroke-width="7" stroke-linecap="round"/>
                <path d="M155 44C158 28 170 20 166 12C162 4 152 22 151 42" stroke="url(#${indigo})" stroke-width="6" stroke-linecap="round"/>
                <g class="sprout-energy">
                  <path class="energy-leaf" d="M132 8C120-5 105 0 112 15C118 20 130 15 132 8Z" fill="#00f0ff"/>
                  <path class="energy-leaf" d="M166 12C180-2 195 5 188 18C182 22 170 18 166 12Z" fill="#00f0ff"/>
                  <circle class="energy-spark" cx="132" cy="0" r="4" fill="#37d7ff"/>
                  <circle class="energy-spark" cx="166" cy="4" r="3.5" fill="#7e5cff"/>
                  <circle class="energy-spark" cx="149" cy="-10" r="5" fill="#00f0ff"/>
                </g>
              </g>

              <g class="right-arm">
                <path d="M245 175C265 165 285 145 290 155C295 165 265 190 240 195" fill="url(#${indigo})" stroke="url(#${indigo})" stroke-width="6" stroke-linecap="round"/>
              </g>

              <g class="eyes-normal">
                <ellipse cx="118" cy="155" rx="14" ry="18" fill="#101828"/>
                <circle class="eye-shine" cx="114" cy="148" r="4.5" fill="#fff"/>
                <circle class="eye-shine" cx="122" cy="158" r="1.5" fill="#fff"/>
                <ellipse class="eyelid" cx="118" cy="155" rx="14.5" ry="18.5" fill="url(#${bodyShade})" stroke="#101828"/>
                <ellipse cx="182" cy="155" rx="14" ry="18" fill="#101828"/>
                <circle class="eye-shine" cx="178" cy="148" r="4.5" fill="#fff"/>
                <circle class="eye-shine" cx="186" cy="158" r="1.5" fill="#fff"/>
                <ellipse class="eyelid" cx="182" cy="155" rx="14.5" ry="18.5" fill="url(#${bodyShade})" stroke="#101828"/>
              </g>

              <g class="eyes-happy">
                <path d="M104 154Q118 146 132 154" stroke="#101828" stroke-width="4" stroke-linecap="round"/>
                <path d="M168 154Q182 146 196 154" stroke="#101828" stroke-width="4" stroke-linecap="round"/>
              </g>

              <g class="eyes-wink">
                <ellipse cx="118" cy="155" rx="14" ry="18" fill="#101828"/>
                <circle cx="114" cy="148" r="4.5" fill="#fff"/>
                <path d="M175 145Q188 155 200 145" stroke="#101828" stroke-width="3.5" stroke-linecap="round"/>
              </g>

              <g class="eyes-sleep">
                <path d="M105 145Q118 155 130 145" stroke="#101828" stroke-width="3.5" stroke-linecap="round"/>
                <path d="M175 145Q188 155 200 145" stroke="#101828" stroke-width="3.5" stroke-linecap="round"/>
              </g>

              <g class="eyes-thinking">
                <path d="M104 135Q118 131 132 135" stroke="#101828" stroke-width="3.4" stroke-linecap="round" opacity=".82"/>
                <path d="M168 135Q182 131 196 135" stroke="#101828" stroke-width="3.4" stroke-linecap="round" opacity=".82"/>
                <path d="M105 152Q118 158 130 152" stroke="#101828" stroke-width="4.2" stroke-linecap="round"/>
                <path d="M175 152Q188 158 200 152" stroke="#101828" stroke-width="4.2" stroke-linecap="round"/>
              </g>

              <path class="mouth" d="M140 172Q150 180 160 172" stroke="#101828" stroke-width="4" stroke-linecap="round"/>

              <g class="chest-logo" transform="translate(120.5 205) scale(.9)">
                <g class="chest-logo-pulse">
                  <circle cx="10" cy="5" r="4.5" fill="url(#${indigo})"/>
                  <rect x="6" y="14" width="8" height="30" rx="4" fill="url(#${indigo})"/>
                  <path d="M34 16S26 23 20 27L33 41C35 43 31 45 28 44L16 31V23L28 14C31 12 34 13 34 16Z" fill="url(#${indigo})"/>
                </g>
              </g>

              <g class="sleep-zzz" opacity="0" pointer-events="none">
                <text class="zzz-1" x="195" y="65" fill="#7e5cff" font-weight="800" font-size="24">Z</text>
                <text class="zzz-2" x="220" y="40" fill="#00f0ff" font-weight="800" font-size="18">z</text>
                <text class="zzz-3" x="240" y="20" fill="#cbd3e6" font-weight="800" font-size="14">z</text>
              </g>
            </svg>
          </span>
        </button>
      </div>

      <button class="launcher" type="button" aria-label="Mostrar a Kimi" title="Mostrar a Kimi">
        <svg viewBox="0 0 300 320" fill="none" aria-hidden="true" focusable="false">
          <path d="M150 40C215 40 250 110 250 180C250 250 205 290 150 290C95 290 50 250 50 180C50 110 85 40 150 40Z" fill="#eef1f7"/>
          <path d="M142 45C138 25 125 15 132 8C140 0 148 20 146 42M155 44C158 28 170 20 166 12C162 4 152 22 151 42" stroke="#6f57f4" stroke-width="7" stroke-linecap="round"/>
          <ellipse cx="118" cy="155" rx="14" ry="18" fill="#101828"/>
          <circle cx="114" cy="148" r="4.5" fill="#fff"/>
          <ellipse cx="182" cy="155" rx="14" ry="18" fill="#101828"/>
          <circle cx="178" cy="148" r="4.5" fill="#fff"/>
          <path d="M140 172Q150 180 160 172" stroke="#101828" stroke-width="4" stroke-linecap="round"/>
        </svg>
        <span class="badge"></span>
      </button>
    `;

    const nonce = this.getAttribute('csp-nonce');
    if (nonce) this.shadowRoot.querySelector('style')?.setAttribute('nonce', nonce);

    this._els = {
      panel: this.shadowRoot.querySelector('.panel'),
      mascot: this.shadowRoot.querySelector('.mascot'),
      close: this.shadowRoot.querySelector('.close'),
      launcher: this.shadowRoot.querySelector('.launcher'),
      live: this.shadowRoot.querySelector('.live'),
      product: this.shadowRoot.querySelector('.product'),
      title: this.shadowRoot.querySelector('.title'),
      message: this.shadowRoot.querySelector('.message')
    };

    this._els.mascot.addEventListener('click', () => {
      this.advance('click');
      this._scheduleCycle();
    });
    this._els.close.addEventListener('click', (event) => {
      event.stopPropagation();
      this.hide();
    });
    this._els.launcher.addEventListener('click', () => this.show());
    this._rendered = true;
  }

  _syncAll() {
    this._syncConfiguration();
    this._applyState('connected', false);
  }

  _syncConfiguration() {
    if (!this._rendered) return;
    this._els.close.hidden = !parseBooleanAttribute(this, 'closable', true);
  }

  _applyState(source, emit) {
    const state = this.state;
    this._els.panel.dataset.state = state;
    this._applyCopy(source);
    if (emit) this._dispatch('kimi-state-change', { state, source });
  }

  _applyCopy(source) {
    const state = this.state;
    const copy = DEFAULT_COPY[state] || DEFAULT_COPY.idle;
    const shouldAnnounce = source !== 'auto' && source !== 'connected';
    this._els.live.setAttribute('aria-live', shouldAnnounce ? 'polite' : 'off');
    this._els.product.textContent = this.getAttribute('product') || 'Kuden';
    this._els.title.textContent = this.getAttribute('bubble-title') || copy.title;
    this._els.message.textContent = this.getAttribute('message') || copy.message;
    if (!shouldAnnounce) this._restoreLiveRegion();
  }

  _restoreLiveRegion() {
    window.requestAnimationFrame(() => {
      if (this._els?.live) this._els.live.setAttribute('aria-live', 'polite');
    });
  }

  _cycleStates() {
    const requested = (this.getAttribute('cycle-states') || 'idle,thinking,success')
      .split(',')
      .map((state) => state.trim())
      .filter((state, index, list) => VALID_STATES.includes(state) && list.indexOf(state) === index);
    return requested.length ? requested : ['idle', 'thinking', 'success'];
  }

  _scheduleCycle() {
    window.clearTimeout(this._timer);
    const enabled = parseBooleanAttribute(this, 'auto-cycle', false);
    if (!enabled || this.minimized || document.hidden || !this.isConnected) return;
    const interval = Math.max(3000, Number(this.getAttribute('cycle-interval')) || 10000);
    this._timer = window.setTimeout(() => {
      this.advance('auto');
      this._scheduleCycle();
    }, interval);
  }

  _dispatch(name, detail) {
    this.dispatchEvent(new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true
    }));
  }
}

if (globalThis.customElements && !globalThis.customElements.get('kuden-kimi-widget')) {
  globalThis.customElements.define('kuden-kimi-widget', KudenKimiWidget);
}

export default KudenKimiWidget;

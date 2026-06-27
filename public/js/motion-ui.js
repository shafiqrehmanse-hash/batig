/* BATIG — Motion.dev spring animations (vanilla JS, no React) */
const MotionUI = {
  get _m() {
    return typeof Motion !== 'undefined' ? Motion : null;
  },

  animate(target, keyframes, options) {
    const m = this._m;
    if (m && m.animate) return m.animate(target, keyframes, options);
    return this._gsap(target, keyframes, options);
  },

  spring(target, keyframes, options = {}) {
    return this.animate(target, keyframes, {
      type: 'spring',
      stiffness: 400,
      damping: 30,
      ...options
    });
  },

  stagger(target, keyframes, options = {}) {
    const els = typeof target === 'string' ? document.querySelectorAll(target) : target;
    if (!els || !els.length) return null;
    const m = this._m;
    const delay = m && m.stagger
      ? m.stagger(0.065, { startDelay: options.startDelay || 0 })
      : (options.startDelay || 0);
    return this.spring(els, keyframes, { ...options, delay });
  },

  init() {
    this._meshPulse();
    this._placeTradePulse();
  },

  _meshPulse() {
    const mesh = document.getElementById('mesh-bg');
    if (!mesh) return;
    this.animate(mesh, {
      filter: ['brightness(1) saturate(1)', 'brightness(1.12) saturate(1.15)', 'brightness(1) saturate(1)']
    }, { duration: 7, repeat: Infinity, ease: 'easeInOut' });
  },

  _placeTradePulse() {
    const btn = document.getElementById('place-trade-btn');
    if (!btn) return;
    this.animate(btn, { boxShadow: [
      '0 0 0 rgba(244,208,63,0)',
      '0 0 28px rgba(244,208,63,0.35)',
      '0 0 0 rgba(244,208,63,0)'
    ]}, { duration: 2.8, repeat: Infinity, ease: 'easeInOut' });
  },

  enterApp() {
    const app = document.getElementById('app');
    if (app) this.spring(app, { opacity: [0, 1] }, { duration: 0.45 });
    this.spring('.header', { y: [-22, 0], opacity: [0, 1] });
    this.spring('.arena', { scale: [0.93, 1], opacity: [0, 1] }, { delay: 0.08 });
    this.spring('.bet-slip', { x: [32, 0], opacity: [0, 1] }, { delay: 0.14 });
    this.stagger('.dice-card', { y: [26, 0], opacity: [0, 1], scale: [0.9, 1] }, { startDelay: 0.1 });
    this.spring('#place-trade-btn', { scale: [0.82, 1], opacity: [0, 1] }, { delay: 0.32, stiffness: 520, damping: 24 });
  },

  dashHeroIn() {
    this.spring('.dash-hero', { opacity: [0, 1], y: [24, 0] }, { stiffness: 360, damping: 28 });
  },

  loginCardIn() {
    this.spring('#login-card', { opacity: [0, 1], y: [36, 0] }, { delay: 0.1, stiffness: 320, damping: 26 });
  },

  tradeModalOpen() {
    const modal = document.querySelector('.trade-modal');
    if (!modal) return;
    this.spring(modal, { scale: [0.86, 1], opacity: [0, 1], y: [36, 0] }, { stiffness: 440, damping: 26 });
    this.stagger('.trade-num-btn', { scale: [0.55, 1], opacity: [0, 1] }, { startDelay: 0.06, stiffness: 500 });
    this.stagger('#trade-chip-row .chip', { y: [12, 0], opacity: [0, 1] }, { startDelay: 0.12 });
  },

  activeTradesReveal() {
    document.querySelectorAll('.active-trade-card').forEach((el) => {
      el.style.transform = 'none';
      el.style.opacity = '1';
      el.classList.remove('at-reveal');
      void el.offsetWidth;
      el.classList.add('at-reveal');
    });
  },

  resultModalOpen() {
    this.spring('#result-modal', { scale: [0.65, 1], opacity: [0, 1] }, { stiffness: 340, damping: 22 });
    this.spring('#result-modal .result-emoji', { scale: [0.4, 1.15, 1], rotate: [-8, 4, 0] }, { stiffness: 500, damping: 18, delay: 0.05 });
    this.spring('.result-num-big', { scale: [0.5, 1.1, 1] }, { stiffness: 480, damping: 20, delay: 0.1 });
  },

  winCard(n) {
    const card = document.querySelector(`.dice-card[data-n="${n}"]`);
    if (card) this.spring(card, { scale: [1, 1.14, 1], y: [0, -8, 0] }, { stiffness: 600, damping: 16 });
  },

  tickerItem(el) {
    if (!el) return;
    this.spring(el, { scale: [0.85, 1], opacity: [0.5, 1] }, { stiffness: 450, damping: 24 });
  },

  _gsap(target, keyframes, options) {
    if (typeof gsap === 'undefined') return null;
    const els = typeof target === 'string' ? document.querySelectorAll(target) : (target.length ? target : [target]);
    const list = els.length !== undefined && !els.tagName ? [...els] : [els];
    list.forEach(el => {
      if (!el || !el.style) return;
      const from = {};
      const to = {};
      Object.keys(keyframes).forEach(k => {
        const v = keyframes[k];
        if (Array.isArray(v)) {
          from[k] = v[0];
          to[k] = v[v.length - 1];
        } else {
          to[k] = v;
        }
      });
      gsap.fromTo(el, from, { ...to, duration: options?.duration || 0.5, ease: options?.ease || 'power2.out' });
    });
    return null;
  }
};

document.addEventListener('DOMContentLoaded', () => MotionUI.init());

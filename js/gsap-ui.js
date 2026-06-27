/* BATIG — GSAP animations (https://gsap.com) */
const GsapUI = {
  get ready() {
    return typeof gsap !== 'undefined';
  },

  _kill(target) {
    if (!this.ready) return;
    gsap.killTweensOf(target);
  },

  init() {
    if (!this.ready) return;

    gsap.to('#mesh-bg', {
      filter: 'brightness(1.1) saturate(1.14)',
      duration: 4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });

    const tradeBtn = document.getElementById('place-trade-btn');
    if (tradeBtn) {
      gsap.to(tradeBtn, {
        boxShadow: '0 0 32px rgba(244,208,63,0.45)',
        duration: 1.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      });
    }

    this._initTickerGlow();
  },

  _initTickerGlow() {
    /* ticker uses CSS scroll — skip GSAP override */
  },

  enterApp(onDone) {
    if (!this.ready) {
      if (onDone) onDone();
      return;
    }
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        this._ensurePlayVisible();
        if (onDone) onDone();
      }
    });
    tl.fromTo('#app', { opacity: 0 }, { opacity: 1, duration: 0.45 })
      .fromTo('.header', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, '-=0.28')
      .fromTo('.arena', { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.55, transformOrigin: 'center top' }, '-=0.32')
      .fromTo('.dice-card',
        { y: 36, opacity: 0, scale: 0.86 },
        { y: 0, opacity: 1, scale: 1, duration: 0.48, stagger: 0.07, ease: 'back.out(1.4)', immediateRender: false },
        '-=0.38')
      .fromTo('#place-trade-btn',
        { scale: 0.75, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, ease: 'elastic.out(1, 0.6)', immediateRender: false },
        '-=0.22')
      .fromTo('.active-trades-panel',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4 },
        '-=0.25');
    return tl;
  },

  _ensurePlayVisible() {
    if (!this.ready) return;
    gsap.set('#app', { opacity: 1 });
    gsap.utils.toArray('.dice-card').forEach((card) => {
      const dim = card.classList.contains('off');
      gsap.set(card, { opacity: dim ? 0.4 : 1, scale: 1, y: 0, clearProps: 'transform' });
    });
    gsap.set('#place-trade-btn', { opacity: 1, scale: 1, clearProps: 'transform' });
    gsap.set('.active-trades-panel, .header, .arena', { opacity: 1, clearProps: 'transform' });
  },

  loginCardIn(sel = '#login-card') {
    if (!this.ready) return;
    return gsap.fromTo(sel,
      { opacity: 0, y: 48, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: 'power3.out', delay: 0.1 }
    );
  },

  dashHeroIn() {
    if (!this.ready) return;
    return gsap.fromTo('.dash-hero',
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
    );
  },

  tradeModalOpen() {
    if (!this.ready) return;
    this._kill('.trade-modal, .trade-num-btn, #trade-chip-row .chip, .trade-slip-preview');
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => this._ensureTradeModalVisible()
    });
    tl.fromTo('.trade-modal',
      { scale: 0.82, opacity: 0, y: 40 },
      { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)' })
      .fromTo('.trade-num-btn',
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.38, stagger: 0.05, ease: 'back.out(2)', immediateRender: false },
        '-=0.28')
      .fromTo('#trade-chip-row .chip',
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.32, stagger: 0.04, immediateRender: false },
        '-=0.22')
      .fromTo('.trade-slip-preview',
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35 },
        '-=0.18');
    return tl;
  },

  _ensureTradeModalVisible() {
    if (!this.ready) return;
    gsap.set('.trade-modal', { opacity: 1, scale: 1, y: 0, clearProps: 'transform' });
    gsap.utils.toArray('.trade-num-btn').forEach((btn) => {
      gsap.set(btn, { opacity: 1, scale: 1, y: 0, clearProps: 'transform' });
    });
    gsap.utils.toArray('#trade-chip-row .chip').forEach((chip) => {
      const dim = chip.classList.contains('chip-off');
      gsap.set(chip, { opacity: dim ? 0.35 : 1, y: 0, clearProps: 'transform' });
    });
    gsap.set('.trade-slip-preview', { opacity: 1, x: 0, clearProps: 'transform' });
  },

  tradeModalClose(onDone) {
    if (!this.ready) {
      if (onDone) onDone();
      return;
    }
    return gsap.to('.trade-modal', {
      scale: 0.88, opacity: 0, y: 24, duration: 0.28, ease: 'power2.in',
      onComplete: () => {
        this._ensureTradeModalVisible();
        if (onDone) onDone();
      }
    });
  },

  activeTradesReveal() {
    if (!this.ready) return;
    gsap.fromTo('.active-trade-card',
      { x: -24, opacity: 0, scale: 0.94 },
      { x: 0, opacity: 1, scale: 1, duration: 0.45, stagger: 0.08, ease: 'back.out(1.5)' }
    );
  },

  resultModalOpen() {
    if (!this.ready) return;
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => this._ensureResultVisible()
    });
    tl.fromTo('#result-modal',
      { scale: 0.55, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(1.8)' })
      .fromTo('#result-trophy',
        { scale: 0.2, rotation: -25 },
        { scale: 1, rotation: 0, duration: 0.65, ease: 'elastic.out(1, 0.55)' },
        '-=0.35')
      .fromTo('#result-dice-hero',
        { scale: 0.15, rotation: -40, opacity: 0 },
        { scale: 1, rotation: 0, opacity: 1, duration: 0.7, ease: 'back.out(2.2)', immediateRender: false },
        '-=0.5')
      .fromTo('.result-num-big',
        { scale: 0.3, rotation: 180 },
        { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(2)' },
        '-=0.4')
      .fromTo('#res-title', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35 }, '-=0.25')
      .fromTo('#res-desc', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 }, '-=0.2');
    return tl;
  },

  _ensureResultVisible() {
    if (!this.ready) return;
    gsap.set('#result-modal, #result-trophy, #result-dice-hero, .result-num-big, #res-title, #res-desc, #res-payout', {
      opacity: 1, scale: 1, y: 0, rotation: 0, clearProps: 'transform'
    });
  },

  rollWinnerReveal() {
    if (!this.ready) return;
    const tl = gsap.timeline();
    tl.fromTo('#roll-winner-hero',
      { scale: 0.3, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.55, ease: 'back.out(2.2)' })
      .fromTo('#roll-winner-dice',
        { rotation: -30, scale: 0.5 },
        { rotation: 0, scale: 1, duration: 0.65, ease: 'elastic.out(1, 0.5)' },
        '-=0.35')
      .fromTo('#roll-winner-num',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' },
        '-=0.25');
    gsap.to('.roll-winner-aura', { scale: 1.15, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    return tl;
  },

  resultNeutral() {
    if (!this.ready) return;
    gsap.fromTo('#result-dice-hero',
      { scale: 0.5, rotation: 180, opacity: 0 },
      { scale: 1, rotation: 0, opacity: 1, duration: 0.65, ease: 'back.out(2)' });
    gsap.to('.result-trophy-rays', { rotation: 360, duration: 12, repeat: -1, ease: 'none' });
    this._spawnGsapCoins(12, '#ffe566', 0.85);
  },

  adminSectionIn(name) {
    if (!this.ready) return;
    const panel = document.querySelector(`.admin-panel[data-panel="${name}"]:not(.admin-panel-disabled)`);
    if (!panel) return;
    gsap.fromTo(panel,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.42, ease: 'power3.out' });
    gsap.fromTo(panel.querySelectorAll('.data tbody tr, .elite-metric, .query-card'),
      { opacity: 0, x: -12 },
      { opacity: 1, x: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out', delay: 0.08 });
  },

  adminShellIn() {
    if (!this.ready) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo('.admin-sidebar',
      { x: -24, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.45 })
      .fromTo('.admin-nav-item:not(.hidden)',
        { x: -16, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.32, stagger: 0.04 },
        '-=0.28')
      .fromTo('.admin-panel.active',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4 },
        '-=0.2');
    return tl;
  },

  resultWin(amount) {
    if (!this.ready) return;
    const tl = gsap.timeline();
    tl.to('#result-trophy', { scale: 1.15, rotation: 8, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1 })
      .to('#res-payout', { scale: 1.12, duration: 0.25, ease: 'power1.inOut', yoyo: true, repeat: 3 }, '-=0.5')
      .fromTo('#res-luck-banner',
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(1.5)' },
        '-=0.6');

    gsap.to('.result-trophy-glow', {
      scale: 1.3, opacity: 1, duration: 0.8, repeat: -1, yoyo: true, ease: 'sine.inOut'
    });

    this._spawnGsapCoins(20, '#f4d03f');
    return tl;
  },

  resultLose() {
    if (!this.ready) return;
    const tl = gsap.timeline();
    tl.to('#result-trophy', { y: -8, duration: 0.35, ease: 'sine.inOut', yoyo: true, repeat: 3 })
      .fromTo('#res-luck-banner', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0);
    this._spawnGsapCoins(10, '#8892a4', 0.6);
    return tl;
  },

  _spawnGsapCoins(count, color, opacity = 1) {
    const layer = document.getElementById('result-fx-layer');
    if (!layer || !this.ready) return;
    const icons = ['💰', '💵', 'PKR', '$$'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.textContent = icons[i % icons.length];
      el.style.cssText = `position:absolute;left:${Math.random() * 90 + 5}%;top:-5%;font-size:${14 + Math.random() * 14}px;font-weight:800;color:${color};opacity:0;pointer-events:none;`;
      layer.appendChild(el);
      gsap.to(el, {
        y: window.innerHeight + 80,
        rotation: 360 + Math.random() * 360,
        opacity,
        duration: 2.5 + Math.random() * 2,
        delay: Math.random() * 1.5,
        ease: 'power1.in',
        onComplete: () => el.remove()
      });
    }
  },

  winCard(n) {
    if (!this.ready) return;
    const card = document.querySelector(`.dice-card[data-n="${n}"]`);
    if (!card) return;
    gsap.timeline()
      .to(card, { scale: 1.12, y: -10, duration: 0.35, ease: 'power2.out' })
      .to(card, { scale: 1, y: 0, duration: 0.4, ease: 'elastic.out(1, 0.5)' });
  },

  diceOverlayOpen() {
    if (!this.ready) return;
    const tl = gsap.timeline({ onComplete: () => this._ensureDiceOverlayVisible() });
    tl.fromTo('#dice-overlay', { opacity: 0 }, { opacity: 1, duration: 0.35 })
      .fromTo('.dice-modal-3d',
        { scale: 0.85, y: 30, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.55, ease: 'back.out(1.5)', immediateRender: false },
        '-=0.2')
      .fromTo('.suspense-slot',
        { scale: 0.6, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.35, stagger: 0.05, ease: 'back.out(1.8)', immediateRender: false },
        '-=0.3');
    return tl;
  },

  _ensureDiceOverlayVisible() {
    if (!this.ready) return;
    gsap.set('#dice-overlay', { opacity: 1 });
    gsap.set('.dice-modal-3d, .suspense-slot', { opacity: 1, scale: 1, y: 0, clearProps: 'transform' });
  },

  diceOverlayShake() {
    if (!this.ready) return;
    gsap.to('#dice-overlay .dice-modal', {
      x: '+=5', duration: 0.05, repeat: 8, yoyo: true, ease: 'power1.inOut',
      onComplete: () => gsap.set('#dice-overlay .dice-modal', { x: 0 })
    });
    gsap.to('.roll-energy-ring', { scale: 1.15, opacity: 0.9, duration: 0.3, yoyo: true, repeat: 3 });
  },

  diceTeasePulse(n) {
    if (!this.ready) return;
    const slot = document.getElementById(`suspense-slot-${n}`);
    if (slot) {
      gsap.fromTo(slot, { scale: 1 }, { scale: 1.25, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' });
    }
    gsap.fromTo('#roll-live-num', { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' });
  },

  diceLandSlam() {
    if (!this.ready) return;
    const tl = gsap.timeline();
    tl.to('#dice-canvas-wrap', { scale: 1.18, duration: 0.12, ease: 'power2.out' })
      .to('#dice-canvas-wrap', { scale: 1, duration: 0.45, ease: 'elastic.out(1, 0.45)' })
      .to('.roll-energy-ring', { scale: 1.4, opacity: 0, duration: 0.5 }, 0);
    gsap.to('.dice-glow', { scale: 1.5, opacity: 1, duration: 0.4, yoyo: true, repeat: 1 });
  },

  phasePulse(el) {
    if (!this.ready || !el) return;
    gsap.fromTo(el, { scale: 1 }, { scale: 1.08, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' });
  },

  balancePop(el) {
    if (!this.ready || !el) return;
    gsap.fromTo(el, { scale: 1 }, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' });
  },

  ringUrgent(on) {
    const ring = document.getElementById('ring-fg');
    if (!this.ready || !ring) return;
    if (on) {
      gsap.to(ring, { strokeWidth: 10, duration: 0.5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    } else {
      this._kill(ring);
      gsap.set(ring, { strokeWidth: 8 });
    }
  },

  clearResult() {
    if (!this.ready) return;
    this._kill('#result-trophy, #res-payout, .result-trophy-glow, #result-modal');
  }
};

document.addEventListener('DOMContentLoaded', () => GsapUI.init());

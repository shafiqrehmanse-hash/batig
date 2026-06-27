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

  enterApp() {
    if (!this.ready) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('#app', { opacity: 0, duration: 0.45 })
      .from('.header', { y: -30, opacity: 0, duration: 0.5 }, '-=0.28')
      .from('.arena', { scale: 0.9, opacity: 0, duration: 0.55, transformOrigin: 'center top' }, '-=0.32')
      .from('.dice-card', { y: 36, opacity: 0, scale: 0.86, duration: 0.48, stagger: 0.07, ease: 'back.out(1.4)' }, '-=0.38')
      .from('#place-trade-btn', { scale: 0.75, opacity: 0, duration: 0.5, ease: 'elastic.out(1, 0.6)' }, '-=0.22')
      .from('.active-trades-panel', { y: 20, opacity: 0, duration: 0.4 }, '-=0.25');
    return tl;
  },

  loginCardIn() {
    if (!this.ready) return;
    return gsap.from('#login-card', { opacity: 0, y: 48, scale: 0.94, duration: 0.75, ease: 'power3.out', delay: 0.1 });
  },

  dashHeroIn() {
    if (!this.ready) return;
    return gsap.from('.dash-hero', { opacity: 0, y: 28, duration: 0.6, ease: 'power2.out' });
  },

  tradeModalOpen() {
    if (!this.ready) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.trade-modal', { scale: 0.82, opacity: 0, y: 40, duration: 0.5, ease: 'back.out(1.6)' })
      .from('.trade-num-btn', { scale: 0.5, opacity: 0, duration: 0.38, stagger: 0.05, ease: 'back.out(2)' }, '-=0.28')
      .from('#trade-chip-row .chip', { y: 16, opacity: 0, duration: 0.32, stagger: 0.04 }, '-=0.22')
      .from('.trade-slip-preview', { x: -20, opacity: 0, duration: 0.35 }, '-=0.18');
    return tl;
  },

  tradeModalClose(onDone) {
    if (!this.ready) {
      if (onDone) onDone();
      return;
    }
    return gsap.to('.trade-modal', {
      scale: 0.88, opacity: 0, y: 24, duration: 0.28, ease: 'power2.in',
      onComplete: onDone
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
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('#result-modal', { scale: 0.55, opacity: 0, duration: 0.55, ease: 'back.out(1.8)' })
      .from('#result-trophy', { scale: 0.2, rotation: -25, duration: 0.65, ease: 'elastic.out(1, 0.55)' }, '-=0.35')
      .from('.result-num-big', { scale: 0.3, rotation: 180, duration: 0.5, ease: 'back.out(2)' }, '-=0.4')
      .from('#res-title', { y: 20, opacity: 0, duration: 0.35 }, '-=0.25')
      .from('#res-desc', { y: 14, opacity: 0, duration: 0.3 }, '-=0.2');
    return tl;
  },

  resultWin(amount) {
    if (!this.ready) return;
    const tl = gsap.timeline();
    tl.to('#result-trophy', { scale: 1.15, rotation: 8, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1 })
      .to('#res-payout', { scale: 1.12, duration: 0.25, ease: 'power1.inOut', yoyo: true, repeat: 3 }, '-=0.5')
      .from('#res-luck-banner', { scale: 0.8, opacity: 0, duration: 0.4, ease: 'back.out(1.5)' }, '-=0.6');

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
      .from('#res-luck-banner', { opacity: 0, y: 12, duration: 0.45, ease: 'power2.out' }, 0);
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
    const tl = gsap.timeline();
    tl.from('#dice-overlay', { opacity: 0, duration: 0.35 })
      .from('.dice-modal-3d', { scale: 0.85, y: 30, opacity: 0, duration: 0.55, ease: 'back.out(1.5)' }, '-=0.2')
      .from('.suspense-slot', { scale: 0.6, opacity: 0, duration: 0.35, stagger: 0.05, ease: 'back.out(1.8)' }, '-=0.3');
    return tl;
  },

  diceOverlayShake() {
    if (!this.ready) return;
    gsap.to('#dice-overlay .dice-modal', {
      x: '+=4', duration: 0.06, repeat: 5, yoyo: true, ease: 'power1.inOut',
      onComplete: () => gsap.set('#dice-overlay .dice-modal', { x: 0 })
    });
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

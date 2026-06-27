/* BATIG — Elite dice visuals (roll + result) */
const DiceVisual = {
  _pipPos: {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]]
  },

  svg(n, size = 'lg') {
    const uid = `d${n}-${size}`;
    const dots = (this._pipPos[n] || []).map(([cx, cy]) =>
      `<circle cx="${cx}" cy="${cy}" r="8" class="elite-pip"/>`
    ).join('');
    return `<svg class="elite-dice-svg elite-dice-${size}" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="face-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2d3a5c"/>
          <stop offset="50%" stop-color="#1a2238"/>
          <stop offset="100%" stop-color="#0d1220"/>
        </linearGradient>
        <linearGradient id="edge-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffe566"/>
          <stop offset="45%" stop-color="#00ff88"/>
          <stop offset="100%" stop-color="#c084fc"/>
        </linearGradient>
        <radialGradient id="shine-${uid}" cx="30%" cy="25%" r="65%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
        <filter id="glow-${uid}">
          <feGaussianBlur stdDeviation="1.8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width="100" height="100" rx="18" fill="url(#face-${uid})" stroke="url(#edge-${uid})" stroke-width="2.5"/>
      <rect width="100" height="100" rx="18" fill="url(#shine-${uid})" pointer-events="none"/>
      <g filter="url(#glow-${uid})">${dots}</g>
    </svg>`;
  },

  mount(el, n, size = 'lg') {
    if (!el || !n) return;
    el.innerHTML = this.svg(n, size);
    el.dataset.n = String(n);
  },

  showRollWinner(n) {
    const hero = document.getElementById('roll-winner-hero');
    const slot = document.getElementById('roll-winner-dice');
    const num = document.getElementById('roll-winner-num');
    if (!hero || !slot) return;
    this.mount(slot, n, 'roll');
    if (num) num.textContent = '#' + n;
    hero.classList.remove('hidden');
    hero.classList.add('roll-winner-show');
    if (typeof GsapUI !== 'undefined' && GsapUI.ready) {
      GsapUI.rollWinnerReveal();
    } else if (typeof gsap !== 'undefined') {
      gsap.fromTo(hero, { scale: 0.35, opacity: 0, rotation: -20 },
        { scale: 1, opacity: 1, rotation: 0, duration: 0.65, ease: 'back.out(2.2)' });
    }
  },

  hideRollWinner() {
    const hero = document.getElementById('roll-winner-hero');
    if (hero) {
      hero.classList.add('hidden');
      hero.classList.remove('roll-winner-show');
    }
  },

  mountResultHero(n) {
    const hero = document.getElementById('result-dice-hero');
    const num = document.getElementById('res-num');
    if (hero) this.mount(hero, n, 'result');
    if (num) num.textContent = n;
  }
};

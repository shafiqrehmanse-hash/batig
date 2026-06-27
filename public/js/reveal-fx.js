/* BATIG — In-arena premium round reveal (no fullscreen dice overlay) */
const RevealFX = {
  _active: false,
  _raf: null,
  _timer: null,
  _particles: [],

  _$(id) { return document.getElementById(id); },

  cancel() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    this._particles = [];
    this._active = false;
    const stage = this._$('reveal-stage');
    if (stage) {
      stage.classList.add('hidden');
      stage.classList.remove('show', 'reveal-trader');
    }
    const num = this._$('reveal-num');
    if (num) num.classList.remove('reveal-land');
  },

  _resizeCanvas(canvas, stage) {
    if (!canvas || !stage) return null;
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  },

  _spawnParticles(w, h, count = 48) {
    this._particles = [];
    for (let i = 0; i < count; i++) {
      this._particles.push({
        x: w * 0.5 + (Math.random() - 0.5) * 40,
        y: h * 0.5 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 2.2,
        vy: (Math.random() - 0.5) * 2.2 - 0.4,
        r: 1 + Math.random() * 2.2,
        life: 0.4 + Math.random() * 0.6,
        hue: Math.random() > 0.5 ? 145 : 48
      });
    }
  },

  _drawParticles(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.55);
    g.addColorStop(0, 'rgba(0,230,118,0.08)');
    g.addColorStop(0.5, 'rgba(244,208,63,0.04)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    this._particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.012;
      if (p.life <= 0) {
        p.x = w * 0.5 + (Math.random() - 0.5) * 60;
        p.y = h * 0.5 + (Math.random() - 0.5) * 60;
        p.life = 0.5 + Math.random() * 0.5;
      }
      const a = Math.max(0, p.life) * (0.35 + 0.35 * Math.sin(t * 0.004 + p.x));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 85%, 62%, ${a})`;
      ctx.fill();
    });
  },

  _runParticles(canvas, stage) {
    const sized = this._resizeCanvas(canvas, stage);
    if (!sized) return;
    const { ctx, w, h } = sized;
    this._spawnParticles(w, h);
    const t0 = performance.now();
    const tick = (now) => {
      if (!this._active) return;
      this._drawParticles(ctx, w, h, now - t0);
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  },

  _buildCycle(winner) {
    const pool = [1, 2, 3, 4, 5, 6].filter(n => n !== winner);
    const seq = [];
    for (let i = 0; i < 6; i++) seq.push(pool[Math.floor(Math.random() * pool.length)]);
    seq.push(winner);
    return seq;
  },

  play(winner, roundId, opts = {}) {
    if (this._active) this.cancel();
    this._active = true;

    const stage = this._$('reveal-stage');
    const numEl = this._$('reveal-num');
    const label = this._$('reveal-label');
    const sub = this._$('reveal-sub');
    const canvas = this._$('reveal-canvas');
    const diceSlot = this._$('reveal-dice');
    if (!stage || !numEl) {
      this._active = false;
      if (opts.onComplete) opts.onComplete();
      return;
    }

    const trader = !!opts.trader;
    const bets = typeof getBetsForResult === 'function' ? getBetsForResult(roundId) : [];
    const stake = bets.reduce((s, b) => s + Number(b.amount), 0);

    stage.classList.remove('hidden');
    stage.classList.add('show');
    stage.classList.toggle('reveal-trader', trader);

    if (label) label.textContent = trader ? 'Round result' : 'Winner';
    if (sub) {
      sub.textContent = trader && stake
        ? `PKR ${stake.toLocaleString()} in play`
        : 'Synced live · UTC round';
    }

    numEl.classList.remove('reveal-land');
    numEl.textContent = '·';

    if (diceSlot && typeof DiceVisual !== 'undefined') {
      diceSlot.innerHTML = '';
      diceSlot.classList.add('hidden');
    }

    this._runParticles(canvas, stage);

    const seq = this._buildCycle(Number(winner));
    let i = 0;
    const step = () => {
      if (!this._active) return;
      if (i < seq.length - 1) {
        numEl.textContent = seq[i];
        numEl.classList.remove('reveal-tick');
        void numEl.offsetWidth;
        numEl.classList.add('reveal-tick');
        i++;
        this._timer = setTimeout(step, 52 + i * 14);
        return;
      }

      numEl.textContent = winner;
      numEl.classList.remove('reveal-tick');
      numEl.classList.add('reveal-land');

      if (diceSlot && typeof DiceVisual !== 'undefined') {
        DiceVisual.mount(diceSlot, winner, 'md');
        diceSlot.classList.remove('hidden');
      }

      if (typeof highlightWinnerCard === 'function') highlightWinnerCard(winner);

      const hold = trader ? 1100 : 2400;
      this._timer = setTimeout(() => {
        this.cancel();
        if (opts.onComplete) opts.onComplete();
      }, hold);
    };

    this._timer = setTimeout(step, 180);
  }
};

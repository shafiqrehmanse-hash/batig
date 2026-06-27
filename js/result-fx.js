/* BATIG — Victory / loss result animations */
const ResultFX = {
  _timers: [],

  clear() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    const layer = document.getElementById('result-fx-layer');
    if (layer) layer.innerHTML = '';
    const modal = document.getElementById('result-modal');
    if (modal) modal.classList.remove('result-win', 'result-lose', 'result-neutral');
    const luck = document.getElementById('res-luck-banner');
    if (luck) luck.classList.add('hidden');
  },

  play(type, opts = {}) {
    this.clear();
    const modal = document.getElementById('result-modal');
    const layer = document.getElementById('result-fx-layer');
    if (!modal || !layer) return;

    modal.classList.add(type === 'win' ? 'result-win' : type === 'lose' ? 'result-lose' : 'result-neutral');

    if (type === 'win') {
      this._playWin(layer, opts);
    } else if (type === 'lose') {
      this._playLose(layer, opts);
    }
  },

  _playWin(layer, opts) {
    const amount = opts.amount || 0;
    this._spawnCoins(layer, 28, 'win');
    this._spawnFloaters(layer, ['🏆', '💰', '💵', '✨', '💎', '🎉'], 14);
    this._spawnCashRoll(layer, 6);

    const luck = document.getElementById('res-luck-banner');
    if (luck) {
      luck.classList.remove('hidden', 'luck-lose');
      luck.classList.add('luck-win');
      luck.innerHTML = `<i class="ti ti-trophy"></i> Victory! PKR ${amount.toLocaleString()} added to your wallet`;
    }

    if (typeof confetti === 'function') {
      confetti({ particleCount: 220, spread: 110, origin: { y: 0.52 }, colors: ['#f4d03f', '#00e676', '#fff', '#d4af37', '#ffe066'] });
      this._timers.push(setTimeout(() => {
        confetti({ particleCount: 90, spread: 70, origin: { x: 0.15, y: 0.55 }, colors: ['#f4d03f', '#00e676'] });
        confetti({ particleCount: 90, spread: 70, origin: { x: 0.85, y: 0.55 }, colors: ['#f4d03f', '#00e676'] });
      }, 350));
    }

    const trophy = document.getElementById('result-trophy');
    if (trophy && typeof MotionUI !== 'undefined') {
      MotionUI.spring(trophy, { scale: [0.2, 1.25, 1], rotate: [-20, 10, 0] }, { stiffness: 520, damping: 16 });
    }
    if (typeof MotionUI !== 'undefined') {
      MotionUI.spring('#res-payout', { scale: [0.6, 1.12, 1], y: [20, 0] }, { stiffness: 450, damping: 20, delay: 0.15 });
    }
  },

  _playLose(layer, opts) {
    const lost = opts.lost || 0;
    this._spawnCoins(layer, 16, 'lose');
    this._spawnFloaters(layer, ['💸', '🍀', '💰', '⭐', '🎲', '🔥'], 10);
    this._spawnCashRoll(layer, 4, 'lose');

    const luck = document.getElementById('res-luck-banner');
    if (luck) {
      luck.classList.remove('hidden', 'luck-win');
      luck.classList.add('luck-lose');
      const msgs = [
        'Next round could be yours — fortune favours the bold!',
        'Stay in the game — big wins come to those who keep playing!',
        'Your lucky number is waiting — try again next round!',
        'Champions never quit — PKR prizes still on the table!'
      ];
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      luck.innerHTML = `<i class="ti ti-clover"></i> ${msg}${lost ? ` · Stake PKR ${lost.toLocaleString()} this round` : ''}`;
    }

    const trophy = document.getElementById('result-trophy');
    if (trophy && typeof MotionUI !== 'undefined') {
      MotionUI.spring(trophy, { scale: [0.85, 1.05, 1], y: [8, 0] }, { stiffness: 380, damping: 22 });
    }

    if (typeof confetti === 'function') {
      confetti({
        particleCount: 40, spread: 50, origin: { y: 0.6 },
        colors: ['#8892a4', '#f4d03f', '#7c9cff'], scalar: 0.8, ticks: 120
      });
    }
  },

  _spawnCoins(layer, count, mode) {
    const labels = ['PKR', '💵', '💰', '$$'];
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = `result-particle result-coin result-coin-${mode}`;
      el.textContent = labels[i % labels.length];
      el.style.left = (4 + Math.random() * 92) + '%';
      el.style.animationDuration = (2.8 + Math.random() * 2.2) + 's';
      el.style.animationDelay = (Math.random() * 1.8) + 's';
      el.style.fontSize = (14 + Math.random() * 16) + 'px';
      layer.appendChild(el);
      this._timers.push(setTimeout(() => el.remove(), 6000));
    }
  },

  _spawnFloaters(layer, icons, count) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'result-particle result-float';
      el.textContent = icons[Math.floor(Math.random() * icons.length)];
      el.style.left = (8 + Math.random() * 84) + '%';
      el.style.animationDuration = (3 + Math.random() * 2) + 's';
      el.style.animationDelay = (Math.random() * 2) + 's';
      layer.appendChild(el);
      this._timers.push(setTimeout(() => el.remove(), 6500));
    }
  },

  _spawnCashRoll(layer, count, mode = 'win') {
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = `result-particle result-cash-roll result-cash-roll-${mode}`;
      el.innerHTML = '<span>PKR</span><span>PKR</span><span>PKR</span>';
      el.style.top = (15 + Math.random() * 55) + '%';
      el.style.animationDuration = (4 + Math.random() * 3) + 's';
      el.style.animationDelay = (Math.random() * 2.5) + 's';
      if (mode === 'lose') el.style.opacity = '0.55';
      layer.appendChild(el);
      this._timers.push(setTimeout(() => el.remove(), 8000));
    }
  }
};

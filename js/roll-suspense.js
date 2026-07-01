/* BATIG — Intelligent dice-roll suspense (bet-aware tease + drama) */
const RollSuspense = {
  _active: false,
  _timers: [],

  _$(id) { return document.getElementById(id); },

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  _myBets(roundId) {
    if (typeof getBetsForResult === 'function' && roundId != null) {
      const snap = getBetsForResult(roundId);
      if (snap.length) return snap;
    }
    if (myActiveBets?.length) return myActiveBets;
    if (roundState?.myBets?.length) return roundState.myBets;
    if (roundState?.myBet) return [roundState.myBet];
    return [];
  },

  /** Build tease order: user's highest stakes first, then decoys — never the winner until land */
  _buildTease(winner, bets) {
    const tease = [];
    const sorted = [...bets].sort((a, b) => Number(b.amount) - Number(a.amount));
    sorted.forEach(b => {
      const n = Number(b.number);
      if (n !== winner && !tease.includes(n)) tease.push(n);
    });
    const pool = this._shuffle([1, 2, 3, 4, 5, 6].filter(n => n !== winner && !tease.includes(n)));
    while (tease.length < 3 && pool.length) tease.push(pool.pop());
    return tease.slice(0, 3);
  },

  _buildScript(winner, roundId) {
    const bets = this._myBets(roundId);
    const betNums = bets.map(b => Number(b.number));
    const totalStake = bets.reduce((s, b) => s + Number(b.amount), 0);
    const hasBets = bets.length > 0;
    const tease = this._buildTease(winner, bets);
    const topPick = bets.length
      ? [...bets].sort((a, b) => Number(b.amount) - Number(a.amount))[0]
      : null;

    return { winner, bets, betNums, totalStake, hasBets, tease, topPick };
  },

  _setMsg(text) {
    const el = this._$('roll-msg');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('roll-msg-pop');
    void el.offsetWidth;
    el.classList.add('roll-msg-pop');
  },

  _setPhase(tag) {
    const el = this._$('roll-phase-tag');
    if (el) el.textContent = tag;
  },

  _setTension(pct) {
    const el = this._$('roll-tension-fill');
    if (el) el.style.width = Math.min(100, Math.max(0, pct)) + '%';
  },

  _buildSuspenseTrack() {
    const track = this._$('suspense-track');
    if (!track) return;
    track.innerHTML = [1, 2, 3, 4, 5, 6].map(n => `
      <div class="suspense-slot" data-n="${n}" id="suspense-slot-${n}">
        <span class="suspense-slot-num">${n}</span>
        <span class="suspense-slot-dot"></span>
      </div>
    `).join('');
  },

  _markUserPicks(script) {
    script.betNums.forEach(n => {
      const slot = this._$(`suspense-slot-${n}`);
      if (slot) slot.classList.add('is-yours');
      const card = document.querySelector(`.dice-card[data-n="${n}"]`);
      if (card) card.classList.add('roll-watch');
    });
    const hint = this._$('roll-stake-hint');
    if (hint && script.hasBets) {
      hint.classList.remove('hidden');
      const odds = window.GAME_CONFIG?.odds || 5;
      const pot = script.totalStake * odds;
      hint.innerHTML = `<i class="ti ti-flame"></i> PKR ${script.totalStake.toLocaleString()} at risk · Win up to <strong>PKR ${pot.toLocaleString()}</strong>`;
    } else if (hint) {
      hint.classList.add('hidden');
    }
  },

  _setLiveFace(n) {
    const el = this._$('roll-live-face');
    const num = this._$('roll-live-num');
    if (!el || !num) return;
    num.textContent = n;
    el.classList.remove('hidden');
    el.classList.remove('roll-live-pop');
    void el.offsetWidth;
    el.classList.add('roll-live-pop');
    if (typeof GsapUI !== 'undefined') GsapUI.diceTeasePulse(n);
  },

  _hideLiveFace() {
    this._$('roll-live-face')?.classList.add('hidden');
  },

  _onDiceFace(n, script) {
    this._setLiveFace(n);
    document.querySelectorAll('.suspense-slot').forEach(s => {
      s.classList.toggle('face-active', parseInt(s.dataset.n) === n);
    });
  },

  _teaseNumber(n, script) {
    document.querySelectorAll('.suspense-slot').forEach(s => s.classList.remove('teasing', 'hot'));
    const slot = this._$(`suspense-slot-${n}`);
    if (slot) slot.classList.add('teasing');

    document.querySelectorAll('.dice-card').forEach(c => c.classList.remove('roll-tease'));
    const card = document.querySelector(`.dice-card[data-n="${n}"]`);
    if (card) card.classList.add('roll-tease');

    const isYours = script.betNums.includes(n);
    if (isYours) {
      this._setMsg(`😱 #${n} — YOUR PICK! Could this be it?`);
      this._setPhase('NEAR MISS');
      if (slot) slot.classList.add('hot');
      if (typeof MotionUI !== 'undefined') {
        MotionUI.spring('#dice-overlay .dice-modal', { scale: [1, 1.03, 1] }, { stiffness: 700, damping: 12 });
      }
    } else {
      this._setMsg(`👀 Slowing… is it #${n}?`);
      this._setPhase('READING FATE');
    }
  },

  _revealWinner(winner, script) {
    document.querySelectorAll('.suspense-slot').forEach(s => s.classList.remove('teasing', 'hot'));
    const slot = this._$(`suspense-slot-${winner}`);
    if (slot) slot.classList.add('winner-flash');
    this._setPhase('RESULT');
    this._setMsg(`Number ${winner}`);
    this._setTension(100);

    const overlay = this._$('dice-overlay');
    if (overlay) overlay.classList.add('suspense-landed');

    document.querySelectorAll('.dice-card').forEach(c => c.classList.remove('roll-tease'));
    const winCard = document.querySelector(`.dice-card[data-n="${winner}"]`);
    if (winCard) winCard.classList.add('roll-tease', 'roll-winner-flash');

    if (typeof DiceVisual !== 'undefined') DiceVisual.showRollWinner(winner);
    this._setLiveFace(winner);
    this._$('roll-live-face')?.classList.add('roll-live-winner');

    if (script.betNums.includes(winner)) {
      setTimeout(() => this._setMsg(`🎉 You won — #${winner}!`), 350);
    } else if (script.hasBets) {
      setTimeout(() => this._setMsg(`Winner: #${winner}`), 350);
    }
  },

  _cleanup() {
    this._timers.forEach(t => clearTimeout(t));
    this._timers = [];
    this._active = false;
    if (typeof DiceVisual !== 'undefined') DiceVisual.hideRollWinner();
    this._hideLiveFace();
    this._$('roll-live-face')?.classList.remove('roll-live-winner');
    document.querySelectorAll('.suspense-slot').forEach(s => s.classList.remove('face-active'));
    document.querySelectorAll('.dice-card').forEach(c => {
      c.classList.remove('roll-watch', 'roll-tease', 'roll-winner-flash');
    });
    const overlay = this._$('dice-overlay');
    if (overlay) overlay.classList.remove('suspense-active', 'suspense-landed', 'suspense-shake', 'show');
  },

  /** Stop roll animation when a new universal minute starts */
  cancel() {
    this._cleanup();
    this._$('dice-overlay')?.classList.remove('show');
  },

  _finish(winner, roundId) {
    const hold = 900;
    this._timers.push(setTimeout(() => {
      this._cleanup();
      this._$('dice-overlay')?.classList.remove('show');
      showResult(winner, roundId);
    }, hold));
  },

  start(winner, roundId) {
    if (this._active) return;
    this._active = true;
    this._timers = [];

    const script = this._buildScript(winner, roundId);
    const overlay = this._$('dice-overlay');
    overlay?.classList.add('show', 'suspense-active');
    this._$('roll-title').textContent = script.hasBets ? 'Rolling your round…' : 'Round reveal';
    this._buildSuspenseTrack();
    this._markUserPicks(script);
    this._setTension(0);
    this._setPhase('ROLLING');
    this._setMsg(script.hasBets
      ? `PKR ${script.totalStake.toLocaleString()} in play — rolling now…`
      : '🎲 Rolling for the winner…');

    if (typeof GsapUI !== 'undefined' && GsapUI.ready) {
      GsapUI.diceOverlayOpen();
    } else if (typeof MotionUI !== 'undefined') {
      MotionUI.spring('#dice-overlay .dice-modal', { scale: [0.88, 1], opacity: [0, 1] }, { stiffness: 380, damping: 26 });
    }

    const cube = this._$('dice-cube');
    const use3d = typeof Dice3D !== 'undefined' && typeof THREE !== 'undefined';
    if (cube) cube.classList.toggle('hidden', use3d);

    const onProgress = (p) => this._setTension(p * 100);
    const onPhase = (phase) => {
      if (phase === 'ignite') {
        this._setPhase('ROLLING');
        this._setMsg('🎲 Rolling…');
      } else if (phase === 'land') {
        this._revealWinner(winner, script);
      }
    };
    const onFace = (n) => this._onDiceFace(n, script);

    if (use3d) {
      Dice3D.init();
      Dice3D.roll(winner, {
        onFace,
        onPhase,
        onProgress,
        onComplete: () => this._finish(winner, roundId)
      });
      return;
    }

    this._runFallbackRoll(winner, roundId, script, { onPhase, onProgress });
  },

  _runFallbackRoll(winner, roundId, script, hooks) {
    const cube = this._$('dice-cube');
    hooks.onPhase('ignite');

    const rot = faceRotations[winner] || faceRotations[1];
    const totalMs = 2200;
    const t0 = performance.now();

    const progressTick = () => {
      if (!this._active) return;
      const p = Math.min(1, (performance.now() - t0) / totalMs);
      hooks.onProgress(p);
      if (p < 1) requestAnimationFrame(progressTick);
    };
    requestAnimationFrame(progressTick);

    if (typeof gsap !== 'undefined' && cube) {
      gsap.set(cube, { rotationX: 12, rotationY: 18, scale: 1 });
      gsap.to(cube, {
        rotationX: rot.x + 540,
        rotationY: rot.y + 360,
        duration: 1.5,
        ease: 'power3.out',
        onComplete: () => {
          gsap.to(cube, {
            rotationX: rot.x,
            rotationY: rot.y,
            duration: 0.55,
            ease: 'power2.out',
            onUpdate() { renderAllDiceFaces(winner); },
            onComplete: () => {
              renderAllDiceFaces(winner);
              hooks.onPhase('land');
              this._finish(winner, roundId);
            }
          });
        }
      });
      gsap.delayedCall(1.35, () => renderAllDiceFaces(winner));
    } else {
      renderAllDiceFaces(winner);
      hooks.onPhase('land');
      this._timers.push(setTimeout(() => this._finish(winner, roundId), 1200));
    }
  }
};

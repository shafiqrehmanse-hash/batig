/* BATIG — Realistic 3D Ludo-style dice (Three.js) + suspense roll phases */
const Dice3D = {
  _renderer: null,
  _scene: null,
  _camera: null,
  _dice: null,
  _goldLight: null,
  _animId: null,
  _idleId: null,
  _idleT: 0,
  _rolling: false,
  _ready: false,
  _camBaseZ: 4.2,

  _pipCanvas(n) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f8f6f0';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#1a1a22';
    const pts = {
      1: [[64, 64]],
      2: [[36, 36], [92, 92]],
      3: [[36, 36], [64, 64], [92, 92]],
      4: [[36, 36], [92, 36], [36, 92], [92, 92]],
      5: [[36, 36], [92, 36], [64, 64], [36, 92], [92, 92]],
      6: [[36, 32], [92, 32], [36, 64], [92, 64], [36, 96], [92, 96]]
    };
    (pts[n] || []).forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
    });
    return c;
  },

  _faceMats() {
    const order = [3, 4, 1, 6, 2, 5];
    return order.map(n => new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(this._pipCanvas(n)),
      roughness: 0.28,
      metalness: 0.12,
      emissive: 0x1a1520,
      emissiveIntensity: 0.08
    }));
  },

  init() {
    if (this._ready || typeof THREE === 'undefined') return false;
    const wrap = document.getElementById('dice-canvas-wrap');
    if (!wrap) return false;

    wrap.innerHTML = '<canvas id="dice-canvas"></canvas>';
    const canvas = document.getElementById('dice-canvas');
    const w = wrap.clientWidth || 280;
    const h = wrap.clientHeight || 280;

    this._renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this._renderer.setSize(w, h);
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this._renderer.shadowMap.enabled = true;

    this._scene = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    this._camera.position.set(0, 1.2, this._camBaseZ);
    this._camera.lookAt(0, 0, 0);

    const amb = new THREE.AmbientLight(0xffffff, 0.72);
    const key = new THREE.DirectionalLight(0xfff8e8, 1.25);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    const rim = new THREE.PointLight(0x7c9cff, 0.55, 20);
    rim.position.set(-2, 2, 3);
    this._goldLight = new THREE.PointLight(0xf4d03f, 0.7, 18);
    this._goldLight.position.set(2.5, 3.5, 2);
    this._scene.add(amb, key, rim, this._goldLight);

    const geo = new THREE.BoxGeometry(1.35, 1.35, 1.35, 4, 4, 4);
    this._dice = new THREE.Mesh(geo, this._faceMats());
    this._dice.castShadow = true;
    this._scene.add(this._dice);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 32),
      new THREE.MeshStandardMaterial({ color: 0x0a0e18, transparent: true, opacity: 0.5 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.85;
    floor.receiveShadow = true;
    this._scene.add(floor);

    this._ready = true;
    this._startIdle();
    return true;
  },

  _startIdle() {
    if (this._idleId || !this._dice) return;
    const tick = () => {
      if (!this._rolling && this._dice) {
        this._idleT += 0.016;
        this._dice.rotation.y += 0.004;
        this._dice.rotation.x = Math.sin(this._idleT * 0.7) * 0.08;
        this._dice.position.y = Math.sin(this._idleT * 1.4) * 0.05;
        this._render();
      }
      this._idleId = requestAnimationFrame(tick);
    };
    this._idleId = requestAnimationFrame(tick);
  },

  _targetRotation(n) {
    const map = {
      1: { x: 0, y: 0, z: 0 },
      2: { x: 0, y: -Math.PI / 2, z: 0 },
      3: { x: -Math.PI / 2, y: 0, z: 0 },
      4: { x: Math.PI / 2, y: 0, z: 0 },
      5: { x: 0, y: Math.PI / 2, z: 0 },
      6: { x: Math.PI, y: 0, z: 0 }
    };
    return map[n] || map[1];
  },

  _lerpRot(a, b, t) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t
    };
  },

  _render() {
    if (!this._renderer) return;
    this._renderer.render(this._scene, this._camera);
  },

  _pulseLight(intensity) {
    if (this._goldLight) this._goldLight.intensity = intensity;
  },

  /**
   * @param {number} winner
   * @param {object|function} optionsOrCallback — legacy: onComplete fn; new: { teaseNumbers, onTease, onPhase, onProgress, onComplete }
   */
  roll(winner, optionsOrCallback) {
    const opts = typeof optionsOrCallback === 'function'
      ? { onComplete: optionsOrCallback }
      : (optionsOrCallback || {});

    if (!this._ready && !this.init()) {
      if (typeof opts.onComplete === 'function') opts.onComplete();
      return;
    }

    this._rolling = true;
    if (this._animId) cancelAnimationFrame(this._animId);

    const teaseNumbers = opts.teaseNumbers || [];
    const onTease = opts.onTease || (() => {});
    const onPhase = opts.onPhase || (() => {});
    const onProgress = opts.onProgress || (() => {});
    const onComplete = opts.onComplete || (() => {});

    const dice = this._dice;
    const target = this._targetRotation(winner);
    const segments = [{ kind: 'burst', ms: 2200, spins: 5.5 }];

    teaseNumbers.forEach(n => {
      segments.push({ kind: 'tease', ms: 820, number: n });
      segments.push({ kind: 'burst', ms: 380, spins: 1.4 });
    });
    segments.push({ kind: 'wobble', ms: 950 });
    segments.push({ kind: 'land', ms: 1500, number: winner });

    let segIdx = 0;
    let segStart = performance.now();
    let rotStart = { x: dice.rotation.x, y: dice.rotation.y, z: dice.rotation.z };
    const totalSegs = segments.length;

    onPhase('ignite');

    const nextSegment = () => {
      segIdx++;
      segStart = performance.now();
      rotStart = { x: dice.rotation.x, y: dice.rotation.y, z: dice.rotation.z };
    };

    const tick = (now) => {
      const seg = segments[segIdx];
      if (!seg) return;

      const t = Math.min(1, (now - segStart) / seg.ms);

      if (seg.kind === 'burst') {
        const ease = 1 - Math.pow(1 - t, 1.8);
        const spin = seg.spins * Math.PI * 2 * ease;
        dice.rotation.x = rotStart.x + spin * 1.15;
        dice.rotation.y = rotStart.y + spin * 1.75;
        dice.rotation.z = rotStart.z + spin * 0.95;
        dice.position.y = Math.sin(t * Math.PI * 10) * 0.22 * (1 - t * 0.4);
        this._pulseLight(0.7 + Math.sin(t * Math.PI * 8) * 0.35);
        this._camera.position.z = this._camBaseZ - ease * 0.35;
      } else if (seg.kind === 'tease') {
        const face = this._targetRotation(seg.number);
        if (t < 0.28) {
          const lt = t / 0.28;
          const spin = lt * Math.PI * 3;
          dice.rotation.x = rotStart.x + spin;
          dice.rotation.y = rotStart.y + spin * 1.4;
          dice.rotation.z = rotStart.z + spin * 0.6;
        } else if (t < 0.78) {
          const lt = (t - 0.28) / 0.5;
          const ease = 1 - Math.pow(1 - lt, 3);
          const r = this._lerpRot(rotStart, face, ease);
          dice.rotation.x = r.x;
          dice.rotation.y = r.y;
          dice.rotation.z = r.z;
          if (!seg._teaseFired && lt > 0.55) {
            seg._teaseFired = true;
            onTease(seg.number);
          }
        } else {
          const w = (t - 0.78) / 0.22;
          dice.rotation.x = face.x + Math.sin(w * Math.PI * 4) * 0.12;
          dice.rotation.y = face.y + Math.sin(w * Math.PI * 3) * 0.1;
          dice.rotation.z = face.z;
        }
        dice.position.y = Math.sin(t * Math.PI) * 0.08;
        this._pulseLight(1.1);
        this._camera.position.z = this._camBaseZ - 0.55;
      } else if (seg.kind === 'wobble') {
        if (!seg._wobbleFired && t > 0.15) {
          seg._wobbleFired = true;
          onPhase('wobble');
        }
        const face = this._targetRotation(winner);
        const wobble = Math.sin(t * Math.PI * 7) * 0.18 * (1 - t);
        dice.rotation.x = face.x + wobble;
        dice.rotation.y = face.y + wobble * 1.3;
        dice.rotation.z = face.z + wobble * 0.7;
        dice.position.y = Math.sin(t * Math.PI * 2) * 0.06;
        this._pulseLight(0.85 + t * 0.4);
        this._camera.position.z = this._camBaseZ - 0.75;
      } else if (seg.kind === 'land') {
        const ease = 1 - Math.pow(1 - t, 4);
        const r = this._lerpRot(rotStart, target, ease);
        dice.rotation.x = r.x;
        dice.rotation.y = r.y;
        dice.rotation.z = r.z;
        dice.position.y = Math.sin(t * Math.PI) * 0.28 * (1 - t);
        this._camera.position.z = this._camBaseZ - 1.05 * ease;
        this._pulseLight(1.4 - t * 0.3);
        if (t > 0.92 && !seg._landFired) {
          seg._landFired = true;
          onPhase('land', winner);
        }
      }

      onProgress((segIdx + t) / totalSegs);
      this._render();

      if (t >= 1) {
        if (seg.kind === 'land') {
          dice.rotation.set(target.x, target.y, target.z);
          dice.position.y = 0;
          this._camera.position.z = this._camBaseZ;
          this._pulseLight(0.7);
          this._rolling = false;
          const wrap = document.getElementById('dice-canvas-wrap');
          if (wrap && typeof MotionUI !== 'undefined') {
            MotionUI.spring(wrap, { scale: [1, 1.1, 1] }, { stiffness: 650, damping: 12 });
          }
          onComplete();
          return;
        }
        nextSegment();
      }

      this._animId = requestAnimationFrame(tick);
    };

    this._animId = requestAnimationFrame(tick);
  },

  dispose() {
    if (this._animId) cancelAnimationFrame(this._animId);
    if (this._idleId) cancelAnimationFrame(this._idleId);
    this._ready = false;
  }
};

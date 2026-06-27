/* BATIG — Realistic 3D Ludo-style dice (Three.js) */
const Dice3D = {
  _renderer: null,
  _scene: null,
  _camera: null,
  _dice: null,
  _animId: null,
  _idleId: null,
  _idleT: 0,
  _rolling: false,
  _ready: false,

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
    this._camera.position.set(0, 1.2, 4.2);
    this._camera.lookAt(0, 0, 0);

    const amb = new THREE.AmbientLight(0xffffff, 0.72);
    const key = new THREE.DirectionalLight(0xfff8e8, 1.25);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    const rim = new THREE.PointLight(0x7c9cff, 0.55, 20);
    rim.position.set(-2, 2, 3);
    const gold = new THREE.PointLight(0xf4d03f, 0.7, 18);
    gold.position.set(2.5, 3.5, 2);
    this._scene.add(amb, key, rim, gold);

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
    const tick = (now) => {
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

  _render() {
    if (!this._renderer) return;
    this._renderer.render(this._scene, this._camera);
  },

  roll(winner, onComplete) {
    if (!this._ready && !this.init()) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    this._rolling = true;
    const dice = this._dice;
    const target = this._targetRotation(winner);
    const start = { x: dice.rotation.x, y: dice.rotation.y, z: dice.rotation.z };
    const spins = 4 + Math.random() * 2;
    const duration = 3200;
    const t0 = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      const ease = t < 0.7
        ? t / 0.7
        : 1 - Math.pow(1 - (t - 0.7) / 0.3, 3);

      dice.rotation.x = start.x + spins * Math.PI * 2 * (1 - ease) + target.x * ease;
      dice.rotation.y = start.y + spins * Math.PI * 1.6 * (1 - ease) + target.y * ease;
      dice.rotation.z = start.z + spins * Math.PI * 1.2 * (1 - ease) + target.z * ease;
      dice.position.y = Math.sin(t * Math.PI * 6) * 0.15 * (1 - t);

      this._render();

      if (t < 1) {
        this._animId = requestAnimationFrame(tick);
      } else {
        dice.rotation.set(target.x, target.y, target.z);
        dice.position.y = 0;
        this._render();
        this._rolling = false;
        const wrap = document.getElementById('dice-canvas-wrap');
        if (wrap && typeof MotionUI !== 'undefined') {
          MotionUI.spring(wrap, { scale: [1, 1.06, 1] }, { stiffness: 650, damping: 14 });
        }
        if (typeof onComplete === 'function') onComplete();
      }
    };

    if (this._animId) cancelAnimationFrame(this._animId);
    this._animId = requestAnimationFrame(tick);
  },

  dispose() {
    if (this._animId) cancelAnimationFrame(this._animId);
    if (this._idleId) cancelAnimationFrame(this._idleId);
    this._ready = false;
  }
};

/* BATIG — Cinematic 3D Ludo dice (Three.js) */
const Dice3D = {
  _renderer: null,
  _scene: null,
  _camera: null,
  _dice: null,
  _diceGroup: null,
  _goldLight: null,
  _greenLight: null,
  _purpleLight: null,
  _particles: null,
  _animId: null,
  _idleId: null,
  _idleT: 0,
  _rolling: false,
  _ready: false,
  _camBaseZ: 4.5,
  _camAngle: 0,

  _pipCanvas(n, hot = false) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#faf6ee');
    grad.addColorStop(1, '#e8e0d0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = hot ? 'rgba(255,229,102,0.5)' : 'rgba(255,215,80,0.2)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, 240, 240);

    const pipColor = hot ? '#c41e3a' : '#1a1a28';
    const pipGlow = hot ? 'rgba(255,80,80,0.6)' : 'rgba(0,0,0,0.15)';
    const pts = {
      1: [[128, 128]],
      2: [[72, 72], [184, 184]],
      3: [[72, 72], [128, 128], [184, 184]],
      4: [[72, 72], [184, 72], [72, 184], [184, 184]],
      5: [[72, 72], [184, 72], [128, 128], [72, 184], [184, 184]],
      6: [[72, 64], [184, 64], [72, 128], [184, 128], [72, 192], [184, 192]]
    };
    (pts[n] || []).forEach(([x, y]) => {
      if (hot) {
        ctx.shadowColor = pipGlow;
        ctx.shadowBlur = 18;
      }
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fillStyle = pipColor;
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    return c;
  },

  _faceMats() {
    const order = [3, 4, 1, 6, 2, 5];
    return order.map(n => {
      const tex = new THREE.CanvasTexture(this._pipCanvas(n));
      tex.anisotropy = 4;
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.22,
        metalness: 0.08,
        emissive: 0x0a0810,
        emissiveIntensity: 0.06
      });
    });
  },

  _refreshFace(n, hot) {
    if (!this._dice) return;
    const order = [3, 4, 1, 6, 2, 5];
    const idx = order.indexOf(n);
    if (idx < 0 || !this._dice.material[idx]) return;
    const tex = new THREE.CanvasTexture(this._pipCanvas(n, hot));
    tex.anisotropy = 4;
    this._dice.material[idx].map = tex;
    this._dice.material[idx].emissiveIntensity = hot ? 0.35 : 0.06;
    this._dice.material[idx].emissive.setHex(hot ? 0x442200 : 0x0a0810);
    this._dice.material[idx].needsUpdate = true;
  },

  _makeParticles() {
    const count = 120;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 4;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.06, color: 0xffe566, transparent: true, opacity: 0, blending: THREE.AdditiveBlending
    });
    return new THREE.Points(geo, mat);
  },

  init() {
    if (this._ready || typeof THREE === 'undefined') return false;
    const wrap = document.getElementById('dice-canvas-wrap');
    if (!wrap) return false;

    wrap.innerHTML = '<canvas id="dice-canvas"></canvas>';
    const canvas = document.getElementById('dice-canvas');
    const w = wrap.clientWidth || 320;
    const h = wrap.clientHeight || 320;

    this._renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this._renderer.setSize(w, h);
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this._renderer.shadowMap.enabled = true;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.15;

    this._scene = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    this._camera.position.set(0, 1.4, this._camBaseZ);
    this._camera.lookAt(0, 0, 0);

    this._scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff5e0, 1.4);
    key.position.set(4, 6, 5);
    key.castShadow = true;
    this._scene.add(key);

    this._goldLight = new THREE.PointLight(0xffe566, 1.2, 22);
    this._goldLight.position.set(2, 4, 3);
    this._greenLight = new THREE.PointLight(0x00ff88, 0.6, 18);
    this._greenLight.position.set(-3, 2, 2);
    this._purpleLight = new THREE.PointLight(0xc084fc, 0.5, 16);
    this._purpleLight.position.set(0, -1, 4);
    this._scene.add(this._goldLight, this._greenLight, this._purpleLight);

    this._diceGroup = new THREE.Group();
    const geo = new THREE.BoxGeometry(1.45, 1.45, 1.45, 2, 2, 2);
    this._dice = new THREE.Mesh(geo, this._faceMats());
    this._dice.castShadow = true;
    this._diceGroup.add(this._dice);

    const edges = new THREE.EdgesGeometry(geo);
    const wire = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: 0xffd700, transparent: true, opacity: 0.85
    }));
    this._diceGroup.add(wire);

    this._scene.add(this._diceGroup);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.5, 48),
      new THREE.MeshStandardMaterial({
        color: 0x06080f, transparent: true, opacity: 0.65,
        metalness: 0.3, roughness: 0.8
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.95;
    floor.receiveShadow = true;
    this._scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.75, 64),
      new THREE.MeshBasicMaterial({ color: 0xffe566, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.92;
    this._scene.add(ring);

    this._particles = this._makeParticles();
    this._scene.add(this._particles);

    this._ready = true;
    this._startIdle();
    return true;
  },

  _startIdle() {
    if (this._idleId || !this._diceGroup) return;
    const tick = () => {
      if (!this._rolling && this._diceGroup) {
        this._idleT += 0.016;
        this._diceGroup.rotation.y += 0.005;
        this._diceGroup.rotation.x = Math.sin(this._idleT * 0.6) * 0.06;
        this._diceGroup.position.y = Math.sin(this._idleT * 1.2) * 0.04;
        this._camAngle += 0.002;
        this._camera.position.x = Math.sin(this._camAngle) * 0.3;
        this._camera.lookAt(0, 0, 0);
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
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  },

  _render() {
    if (this._renderer) this._renderer.render(this._scene, this._camera);
  },

  _burstParticles(intensity) {
    if (!this._particles) return;
    this._particles.material.opacity = Math.min(1, intensity);
    const arr = this._particles.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += (Math.random() - 0.5) * 0.08 * intensity;
      arr[i + 1] += Math.random() * 0.06 * intensity;
      arr[i + 2] += (Math.random() - 0.5) * 0.08 * intensity;
    }
    this._particles.geometry.attributes.position.needsUpdate = true;
  },

  _pickWobbleFace(winner, teaseNumbers) {
    let n = teaseNumbers.length ? teaseNumbers[teaseNumbers.length - 1] : null;
    if (!n || n === winner) {
      const pool = [1, 2, 3, 4, 5, 6].filter(x => x !== winner);
      n = pool[Math.floor(Math.random() * pool.length)];
    }
    return n;
  },

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

    const teaseNumbers = (opts.teaseNumbers || []).slice(0, 3);
    const onTease = opts.onTease || (() => {});
    const onFace = opts.onFace || (() => {});
    const onPhase = opts.onPhase || (() => {});
    const onProgress = opts.onProgress || (() => {});
    const onComplete = opts.onComplete || (() => {});

    const dice = this._diceGroup;
    const target = this._targetRotation(winner);
    const wobbleNum = this._pickWobbleFace(winner, teaseNumbers);

    const segments = [{ kind: 'burst', ms: 2000, spins: 7 }];

    teaseNumbers.forEach(n => {
      segments.push({ kind: 'tease', ms: 1100, number: n });
      segments.push({ kind: 'burst', ms: 320, spins: 1.6 });
    });
    segments.push({ kind: 'wobble', ms: 1300, number: wobbleNum });
    segments.push({ kind: 'land', ms: 2200, number: winner });

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
      this._camAngle += 0.018;

      if (seg.kind === 'burst') {
        const ease = 1 - Math.pow(1 - t, 2);
        const spin = seg.spins * Math.PI * 2 * ease;
        dice.rotation.x = rotStart.x + spin * 1.2;
        dice.rotation.y = rotStart.y + spin * 2;
        dice.rotation.z = rotStart.z + spin * 0.8;
        dice.position.y = Math.abs(Math.sin(t * Math.PI * 12)) * 0.35 * (1 - t * 0.3);
        dice.scale.setScalar(1 + Math.sin(t * Math.PI * 6) * 0.06);
        this._goldLight.intensity = 1 + Math.sin(t * Math.PI * 10) * 0.8;
        this._greenLight.intensity = 0.4 + Math.sin(t * Math.PI * 8) * 0.3;
        this._camera.position.x = Math.sin(this._camAngle * 3) * 0.6;
        this._camera.position.y = 1.4 + Math.sin(t * Math.PI * 4) * 0.25;
        this._camera.position.z = this._camBaseZ - ease * 0.5;
        this._camera.lookAt(0, dice.position.y * 0.5, 0);
        this._burstParticles(0.3 + t * 0.5);
      } else if (seg.kind === 'tease') {
        const face = this._targetRotation(seg.number);
        if (t < 0.22) {
          const lt = t / 0.22;
          const spin = lt * Math.PI * 4;
          dice.rotation.x = rotStart.x + spin;
          dice.rotation.y = rotStart.y + spin * 1.5;
          dice.rotation.z = rotStart.z + spin * 0.5;
        } else if (t < 0.82) {
          const lt = (t - 0.22) / 0.6;
          const ease = 1 - Math.pow(1 - lt, 4);
          const r = this._lerpRot(rotStart, face, ease);
          dice.rotation.x = r.x;
          dice.rotation.y = r.y;
          dice.rotation.z = r.z;
          if (!seg._faceFired && lt > 0.72) {
            seg._faceFired = true;
            this._refreshFace(seg.number, false);
            onFace(seg.number);
            onTease(seg.number);
          }
        } else {
          const w = (t - 0.82) / 0.18;
          dice.rotation.x = face.x + Math.sin(w * Math.PI * 5) * 0.08;
          dice.rotation.y = face.y + Math.sin(w * Math.PI * 4) * 0.06;
          dice.rotation.z = face.z;
        }
        dice.position.y = Math.sin(t * Math.PI) * 0.12;
        dice.scale.setScalar(1.08);
        this._goldLight.intensity = 1.6;
        this._purpleLight.intensity = 0.8;
        this._camera.position.z = this._camBaseZ - 0.7;
        this._burstParticles(0.15);
      } else if (seg.kind === 'wobble') {
        if (!seg._wobbleFired && t > 0.1) {
          seg._wobbleFired = true;
          onPhase('wobble');
        }
        const face = this._targetRotation(seg.number);
        const wobble = Math.sin(t * Math.PI * 9) * 0.22 * (1 - t * 0.5);
        dice.rotation.x = face.x + wobble;
        dice.rotation.y = face.y + wobble * 1.4;
        dice.rotation.z = face.z + wobble * 0.6;
        dice.position.y = Math.sin(t * Math.PI * 3) * 0.08;
        dice.scale.setScalar(1.04);
        this._goldLight.intensity = 1.2 + t * 0.5;
        this._camera.position.z = this._camBaseZ - 0.85;
        onFace(seg.number);
      } else if (seg.kind === 'land') {
        if (!seg._landStartFired && t > 0.05) {
          seg._landStartFired = true;
          onPhase('land', winner);
          this._refreshFace(winner, true);
          onFace(winner);
        }
        const ease = t < 0.65
          ? 1 - Math.pow(1 - t / 0.65, 3)
          : 1;
        const extraSpin = t < 0.5 ? (1 - Math.pow(1 - t / 0.5, 2)) * Math.PI * 2 : 0;
        const r = this._lerpRot(rotStart, target, ease);
        dice.rotation.x = r.x + extraSpin * 0.3;
        dice.rotation.y = r.y + extraSpin;
        dice.rotation.z = r.z + extraSpin * 0.2;
        dice.position.y = Math.sin(t * Math.PI) * 0.35 * (1 - t);
        dice.scale.setScalar(1 + (1 - t) * 0.12);
        this._goldLight.intensity = 2 - t * 0.5;
        this._greenLight.intensity = 0.8 + t * 0.6;
        this._camera.position.z = this._camBaseZ - 1.2 * ease;
        this._camera.position.x = Math.sin(this._camAngle) * 0.15 * (1 - t);
        this._burstParticles(0.5 * (1 - t));
      }

      onProgress((segIdx + t) / totalSegs);
      this._render();

      if (t >= 1) {
        if (seg.kind === 'land') {
          dice.rotation.set(target.x, target.y, target.z);
          dice.position.y = 0;
          dice.scale.setScalar(1);
          this._camera.position.set(0, 1.4, this._camBaseZ);
          this._camera.lookAt(0, 0, 0);
          this._goldLight.intensity = 1.4;
          this._greenLight.intensity = 0.9;
          if (this._particles) this._particles.material.opacity = 0;
          this._rolling = false;

          const wrap = document.getElementById('dice-canvas-wrap');
          if (wrap && typeof GsapUI !== 'undefined' && GsapUI.ready) {
            GsapUI.diceLandSlam();
          } else if (wrap && typeof gsap !== 'undefined') {
            gsap.fromTo(wrap, { scale: 1 }, { scale: 1.14, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' });
          }
          onComplete();
          return;
        }
        dice.scale.setScalar(1);
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

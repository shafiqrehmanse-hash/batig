/* BATIG Pro — Complete Betting App */
const BET_AMOUNTS = [50, 100, 200, 500, 1000, 2000];
const BETTING_SEC = 45;
const LOCK_END = 55;
const RING_C = 502;

let user = null;
let selectedNum = null;
let betAmount = 0;
let betLocked = false;
let roundState = null;
let pollTimer = null;
let resultShown = null;
let diceShown = null;
let exposureChannel = null;
let _lastPhase = null;
let winHistory = [];
let depositMethod = 'easypaisa';
let withdrawMethod = 'easypaisa';
let depositChannel = null;
let withdrawChannel = null;
let _proofCache = {};
let adminCharts = {};

function destroyAdminCharts() {
  Object.values(adminCharts).forEach(c => { try { c?.destroy(); } catch (_) {} });
  adminCharts = {};
}

function setDashText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function animateEliteMetrics() {
  document.querySelectorAll('.elite-metric').forEach((el, i) => {
    el.classList.remove('visible');
    setTimeout(() => el.classList.add('visible'), 70 * i);
  });
  if (typeof gsap !== 'undefined') {
    gsap.fromTo('.dash-hero', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' });
  }
}

function renderAdminCharts(d) {
  if (typeof Chart === 'undefined') return;
  destroyAdminCharts();
  const rounds = [...(d.rounds || [])].reverse();
  if (!rounds.length) return;

  const labels = rounds.map(r => '#' + r.id);
  const plData = rounds.map(r => r.housePL);
  let cumulative = 0;
  const cumData = rounds.map(r => { cumulative += r.housePL; return cumulative; });
  const totalPool = rounds.reduce((s, r) => s + r.pool, 0);
  const totalHouse = rounds.reduce((s, r) => s + r.housePL, 0);
  const totalPaid = Math.max(0, totalPool - totalHouse);
  const gold = '#f4d03f';
  const green = '#00e676';
  const grid = 'rgba(255,255,255,0.06)';
  const muted = '#8892a4';

  Chart.defaults.color = muted;
  Chart.defaults.borderColor = grid;
  Chart.defaults.font.family = "'Inter', sans-serif";

  const lineCtx = $('chart-profit-line');
  if (lineCtx) {
    adminCharts.line = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Cumulative earnings',
          data: cumData,
          borderColor: gold,
          backgroundColor: 'rgba(244,208,63,0.12)',
          fill: true,
          tension: 0.42,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: gold,
          borderWidth: 2.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: grid }, ticks: { callback: v => 'PKR ' + Number(v).toLocaleString() } },
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } }
        },
        animation: { duration: 1400, easing: 'easeOutQuart' }
      }
    });
  }

  const donutCtx = $('chart-pool-donut');
  if (donutCtx) {
    adminCharts.donut = new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: ['House earnings', 'Player payouts'],
        datasets: [{
          data: [Math.max(0, totalHouse), totalPaid],
          backgroundColor: [green, 'rgba(124,58,237,0.75)'],
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: { legend: { display: false } },
        animation: { animateRotate: true, duration: 1500 }
      }
    });
    const leg = $('chart-legend');
    if (leg) {
      leg.innerHTML = `<span><i style="background:${green}"></i> House PKR ${totalHouse.toLocaleString()}</span>
        <span><i style="background:#7c3aed"></i> Payouts PKR ${totalPaid.toLocaleString()}</span>`;
    }
  }

  const barCtx = $('chart-round-bars');
  if (barCtx) {
    adminCharts.bars = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'House P/L',
          data: plData,
          backgroundColor: plData.map(v => v >= 0 ? 'rgba(0,230,118,0.75)' : 'rgba(255,82,82,0.75)'),
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: grid } },
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } }
        },
        animation: { duration: 1100, delay: ctx => ctx.dataIndex * 35 }
      }
    });
  }
}

const $ = id => document.getElementById(id);

function isStaffUser() {
  return ROLES.isStaff(user?.role || window.currentUser?.role);
}

// ── Dice SVG generator ──
function diceSVG(n) {
  const pos = {
    1: [[50,50]], 2: [[28,28],[72,72]], 3: [[28,28],[50,50],[72,72]],
    4: [[28,28],[72,28],[28,72],[72,72]], 5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
    6: [[28,28],[72,28],[28,50],[72,50],[28,72],[72,72]]
  };
  const dots = (pos[n] || []).map(([cx,cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="7" fill="currentColor"/>`
  ).join('');
  return `<svg class="dice-svg" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="16" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>${dots}</svg>`;
}

// ── Particles ──
function initParticles() {
  const c = $('particles');
  const ctx = c.getContext('2d');
  let parts, w, h;
  function resize() {
    w = c.width = innerWidth; h = c.height = innerHeight;
    parts = Array.from({length: 80}, () => ({
      x: Math.random()*w, y: Math.random()*h,
      r: Math.random()*1.5+0.3,
      vx: (Math.random()-0.5)*0.2, vy: (Math.random()-0.5)*0.2,
      a: Math.random()*0.5+0.1
    }));
  }
  function draw() {
    ctx.clearRect(0,0,w,h);
    parts.forEach(p => {
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=w; if(p.x>w)p.x=0; if(p.y<0)p.y=h; if(p.y>h)p.y=0;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(212,175,55,${p.a})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  resize(); addEventListener('resize', resize); draw();
}

// ── 3D dice dots ──
const dotMap = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
function renderDots(id, val) {
  const el = $(id); if(!el) return;
  el.innerHTML = '';
  const p = dotMap[val]||[];
  for(let i=0;i<9;i++){const d=document.createElement('div');d.className='dd'+(p.includes(i)?'':' h');el.appendChild(d);}
}
function renderAllDiceFaces(n) {
  const opp={1:6,2:5,3:4,4:3,5:2,6:1};
  renderDots('df-front',n); renderDots('df-back',opp[n]);
  renderDots('df-right',n<=3?n+1:n-1); renderDots('df-left',opp[n<=3?n+1:n-1]);
  renderDots('df-top',n<=2?3:2); renderDots('df-bottom',n<=2?4:5);
}

// ── UI helpers ──
function toast(msg, ok) {
  const t=$('toast'); t.textContent=msg; t.className='toast show'+(ok?' ok':'');
  setTimeout(()=>t.classList.remove('show'),3200);
}

function showAlert(id,msg){const e=$(id);e.textContent=msg;e.classList.add('show');}
function hideAlerts(){document.querySelectorAll('.alert').forEach(a=>a.classList.remove('show'));}

async function checkSetup() {
  const b = $('setup-banner');
  if (!b) return;
  const cfg = window.BATIG_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnon) {
    b.textContent = 'Database not connected — add SUPABASE_URL + SUPABASE_ANON_KEY in Vercel → Redeploy';
    b.classList.add('show');
  } else {
    b.classList.remove('show');
  }
}

function animNum(el, to) {
  const from = parseInt(String(el.textContent).replace(/[^0-9]/g,''))||0;
  if(typeof gsap!=='undefined'){
    gsap.to({v:from},{v:to,duration:0.7,ease:'power2.out',
      onUpdate(){el.textContent=Math.round(this.targets()[0].v).toLocaleString();}});
  } else el.textContent=to.toLocaleString();
}

function setRing(pct, urgent) {
  const fg=$('ring-fg');
  fg.style.strokeDashoffset = RING_C * (1 - pct);
  fg.classList.toggle('urgent', urgent);
}

function switchCMSTab(name) {
  document.querySelectorAll('.cms-tab').forEach(t => t.classList.toggle('active', t.dataset.cmsTab === name));
  document.querySelectorAll('.cms-tab-panel').forEach(p => p.classList.remove('active'));
  const panel = $('cms-tab-' + name);
  if (panel) panel.classList.add('active');
}

function updateSlip() {
  const odds = window.GAME_CONFIG?.odds || 5;
  const oddsEl = $('slip-odds');
  const oddsDisp = $('slip-odds-display');
  if (oddsEl) oddsEl.textContent = odds;
  if (oddsDisp) oddsDisp.textContent = odds;
  const empty=$('slip-empty'), details=$('slip-details');
  if(!selectedNum||!betAmount){
    empty.classList.remove('hidden'); details.classList.add('hidden'); return;
  }
  empty.classList.add('hidden'); details.classList.remove('hidden');
  $('slip-num').textContent='#'+selectedNum;
  $('slip-stake').textContent='PKR '+betAmount.toLocaleString();
  $('slip-win').textContent='PKR '+(betAmount*(window.GAME_CONFIG?.odds||5)).toLocaleString();
}

// ── Auth ──
function showAuth(which) {
  $('screen-login').classList.toggle('hidden', which!=='login');
  $('screen-register').classList.toggle('hidden', which!=='register');
  $('app').classList.add('hidden');
  const card = which==='login' ? $('login-card') : $('register-card');
  if(typeof gsap!=='undefined'){
    gsap.fromTo(card,{opacity:0,y:40,scale:0.95},{opacity:1,y:0,scale:1,duration:0.7,ease:'power3.out'});
  }
}

async function doLogin() {
  hideAlerts();
  try {
    const d = await DirectAuth.login({username:$('login-user').value.trim(),password:$('login-pass').value});
    await enterApp(d.user);
    const profile = await DirectAuth.loadProfile();
    renderHistory(profile.history);
    renderReferrals(profile.referrals);
  } catch(e){showAlert('login-error',e.message);}
}

async function doRegister() {
  hideAlerts();
  try {
    const d = await DirectAuth.register({
      username:$('reg-user').value.trim(), password:$('reg-pass').value,
      phone:$('reg-phone').value.trim(), referralCode:$('reg-referral').value.trim()
    });
    if(d.referralBonus) toast('Referrer earned PKR '+d.referralBonus+'!',true);
    await enterApp(d.user);
    renderHistory([]);
    renderReferrals([]);
  } catch(e){showAlert('register-error',e.message);}
}

function doLogout() {
  DirectAuth.clearSession(); API.setToken(null); user=null; clearInterval(pollTimer);
  $('app').classList.add('hidden'); showAuth('login');
}

async function enterApp(u) {
  try {
  if (!API.token) {
    DirectAuth.clearSession();
    $('loader').classList.add('hidden');
    showAuth('login');
    toast('Please sign in again to continue');
    return;
  }
  const fresh = await DirectAuth.refreshUser().catch(() => null);
  if (fresh) u = fresh;
  user = u;
  $('screen-login').classList.add('hidden');
  $('screen-register').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('loader').classList.add('hidden');

  await CMS.load().catch(() => {});
  await Deposits.loadPaymentSettings().catch(() => {});

  const perms = await ROLES.fetchPermissions(u.role || 'player');
  window.currentUser = { ...u, permissions: perms };
  ROLES.buildAdminPanel(u.role || 'player', perms);

  if (ROLES.isStaff(u.role)) {
    switchTab('admin');
    document.body.classList.add('admin-mode');
  }

  const ini=(u.username||'??').substring(0,2).toUpperCase();
  $('nav-avatar').textContent=ini;
  $('profile-avatar').textContent=ini;

  buildDiceRow(); buildChips(); renderAllDiceFaces(1);
  updateUserUI(); buildTicker();
  if (!ROLES.isStaff(u.role)) {
    setupExposureRealtime();
    startPolling();
  } else {
    loadAdmin();
    setupDepositRealtime();
    setupWithdrawRealtime();
  }

  if(typeof gsap!=='undefined'){
    gsap.to('#app',{opacity:1,duration:0.5});
    gsap.from('.header',{y:-20,opacity:0,duration:0.4});
    gsap.from('.arena',{scale:0.95,opacity:0,duration:0.5,delay:0.1});
    gsap.from('.bet-slip',{x:30,opacity:0,duration:0.5,delay:0.2});
  } else $('app').style.opacity=1;
  } catch (e) {
    console.error('enterApp failed:', e);
    $('app').style.opacity = '1';
    toast(e.message || 'Failed to load app');
  }
}

function updateUserUI() {
  if(!user) return;
  animNum($('nav-balance'), user.balance);
  $('wallet-bal').textContent=user.balance.toLocaleString();
  $('profile-name').textContent=user.username;
  $('profile-sub').textContent='Member since '+new Date(user.createdAt).toLocaleDateString('en-PK',{month:'short',year:'numeric'});
  $('stat-balance').textContent=user.balance.toLocaleString();
  $('stat-wins').textContent=user.wins;
  $('stat-rounds').textContent=user.rounds;
  $('stat-wins-u').textContent=user.wins;
  $('stat-rate').textContent=user.rounds?Math.round(user.wins/user.rounds*100)+'%':'0%';
  $('my-referral-code').textContent=user.referralCode;
}

// ── Build UI ──
function buildDiceRow() {
  const row=$('dice-row'); row.innerHTML='';
  for(let n=1;n<=6;n++){
    const card=document.createElement('div');
    card.className='dice-card number-card'; card.dataset.n=n;
    card.innerHTML=`${diceSVG(n)}<div class="dice-num-label">Number ${n}</div><div class="safe-tag dice-hot dice-cold hidden" id="safe-${n}">SAFE</div><div class="dice-pool-amt" id="pool-${n}">PKR 0</div><div class="exposure-bar"><div class="exposure-fill" id="exp-${n}" style="width:0%"></div></div>`;
    card.onclick=()=>pickNum(n);
    row.appendChild(card);
  }
}

function buildChips() {
  const row=$('chip-row'); row.innerHTML='';
  BET_AMOUNTS.forEach(amt=>{
    const c=document.createElement('button');
    c.className='chip'; c.textContent='PKR '+amt.toLocaleString();
    c.onclick=()=>{
      document.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));
      c.classList.add('on'); betAmount=amt; $('custom-bet').value='';
      updateSlip(); updateBetBtn();
      if(typeof gsap!=='undefined') gsap.from(c,{scale:0.9,duration:0.2,ease:'back.out(2)'});
    };
    row.appendChild(c);
  });
}

function buildTicker() {
  const items = winHistory.length ? winHistory : [3,5,1,6,2,4,3,5,6,1];
  const html = [...items,...items].map((n,i)=>
    `<span class="ticker-item"><span class="w">${n}</span> Round winner</span>`
  ).join('');
  $('ticker-track').innerHTML=html;
}

function setCustomBet() {
  const v=parseInt($('custom-bet').value);
  if(v>=10){betAmount=v;document.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));updateSlip();updateBetBtn();}
}

function pickNum(n) {
  if(betLocked||!roundState||roundState.phase!=='betting') return;
  selectedNum=n;
  document.querySelectorAll('.dice-card').forEach(c=>{
    c.classList.toggle('sel',parseInt(c.dataset.n)===n);
  });
  updateSlip(); updateBetBtn();
  if(typeof gsap!=='undefined'){
    gsap.fromTo(`.dice-card[data-n="${n}"]`,{scale:0.88},{scale:1,duration:0.35,ease:'back.out(2.5)'});
  }
}

function updateBetBtn() {
  $('bet-btn').disabled=!(selectedNum&&betAmount>0&&!betLocked&&roundState?.phase==='betting');
}

async function placeBet() {
  if (window.GAME_CONFIG?.maintenanceMode) return toast('Maintenance mode — betting paused');
  if (window.GAME_CONFIG?.bettingOpen === false) return toast('Betting is temporarily closed');
  const min = window.GAME_CONFIG?.minBet || 50;
  const max = window.GAME_CONFIG?.maxBet || 10000;
  if (betAmount < min) return toast('Minimum bet PKR ' + min);
  if (betAmount > max) return toast('Maximum bet PKR ' + max);
  try {
    const d = await API.bet({ number: selectedNum, amount: betAmount });
    betLocked = true;
    user.balance = d.balance;
    animNum($('nav-balance'), user.balance);
    $('wallet-bal').textContent = user.balance.toLocaleString();
    $('bet-btn').disabled = true;
    $('bet-btn').innerHTML = `<i class="ti ti-lock"></i> Locked — PKR ${betAmount}`;
    document.querySelectorAll('.dice-card').forEach(c => c.classList.add('off'));
    toast('Bet confirmed! PKR ' + betAmount + ' on #' + selectedNum, true);
    if (typeof gsap !== 'undefined') gsap.from('.bet-slip', { boxShadow: '0 0 40px rgba(0,230,118,0.3)', duration: 0.4 });
    tick();
  } catch (e) { toast(e.message); }
}

// ── Round polling ──
function localRoundInfo() {
  const roundId = Math.floor(Date.now() / 60000);
  const sec = Math.floor((Date.now() - roundId * 60000) / 1000);
  const secLeft = 60 - sec;
  let phase;
  if (sec < BETTING_SEC) phase = 'betting';
  else if (sec < LOCK_END) phase = 'locked';
  else phase = 'rolling';
  return {
    roundId, sec, secLeft, phase,
    utc: new Date().toISOString(),
    bets: roundState?.bets || [0, 0, 0, 0, 0, 0],
    pool: roundState?.pool || 0,
    players: roundState?.players || 0,
    lastWinner: roundState?.lastWinner || null,
    myBet: roundState?.myBet || null,
    resolved: false,
    winner: null
  };
}

function renderRoundUI(d) {
  const utcEl = $('hdr-utc');
  const utcStr = new Date(d.utc).toISOString().substr(11,8) + ' UTC';
  if (utcEl.textContent !== utcStr) {
    utcEl.textContent = utcStr;
    utcEl.classList.remove('pulse');
    void utcEl.offsetWidth;
    utcEl.classList.add('pulse');
  }
  $('round-tag').textContent='Round #'+d.roundId;
  $('stat-pool').textContent=(d.pool||0).toLocaleString();
  $('stat-players').textContent=d.players||0;
  if(d.lastWinner){$('stat-last').textContent='#'+d.lastWinner;}

  const phaseEl=$('phase-tag');
  const ringSec=$('ring-sec');
  const ringLbl=$('ring-lbl');

  if(d.phase==='betting'){
    const left=BETTING_SEC-d.sec;
    phaseEl.textContent='BETTING OPEN'; phaseEl.className='phase-pill ph-bet';
    ringSec.textContent=left; ringLbl.textContent='seconds left';
    $('arena-title').textContent='Place your bet';
    $('arena-desc').textContent='Pick a number and confirm before the timer ends.';
    setRing(left/BETTING_SEC, left<=10);

    if(d.myBet&&!betLocked){selectedNum=d.myBet.number;betAmount=d.myBet.amount;betLocked=true;syncBetUI(d.myBet);}
  } else if(d.phase==='locked'){
    const left=LOCK_END-d.sec;
    phaseEl.textContent='LOCKED'; phaseEl.className='phase-pill ph-lock';
    ringSec.textContent=left; ringLbl.textContent='locked';
    $('arena-title').textContent='Bets locked';
    setRing(left/(LOCK_END-BETTING_SEC), true);
  } else {
    phaseEl.textContent='ROLLING'; phaseEl.className='phase-pill ph-roll';
    const left=60-d.sec;
    ringSec.textContent=left; ringLbl.textContent='revealing';
    $('arena-title').textContent='Dice rolling…';
    setRing(left/5, false);

    if(d.sec>=LOCK_END&&d.winner&&diceShown!==d.roundId) {
      if (!isStaffUser()) startDiceRoll(d.winner,d.roundId);
      else diceShown = d.roundId;
    }
    else if(d.sec>=LOCK_END&&!d.resolved&&diceShown!==d.roundId) API.resolveRound(d.roundId).catch(()=>{});
  }

  if(d.phase==='betting'&&d.sec<2&&resultShown===d.roundId-1) resetRound();

  const maxBet=Math.max(...(d.bets||[0]),1);
  const nonzero=(d.bets||[]).filter(b=>b>0);
  const minBet=nonzero.length?Math.min(...nonzero):0;
  (d.bets||[0,0,0,0,0,0]).forEach((b,i)=>{
    const el=$('pool-'+(i+1));
    if(el) el.textContent='PKR '+b.toLocaleString();
    const fill=$('exp-'+(i+1));
    if(fill) {
      fill.style.width=Math.round((b/maxBet)*100)+'%';
      fill.style.background=b===minBet&&b<maxBet?'var(--brand-secondary)':b===maxBet&&maxBet>0?'var(--brand-danger)':'var(--brand-primary)';
    }
    const card=document.querySelector(`.dice-card[data-n="${i+1}"]`);
    if(!card) return;
    const safe=$('safe-'+(i+1));
    if(b===minBet&&b>0&&safe){safe.classList.remove('hidden');safe.textContent='SAFE';}
    else if(safe) safe.classList.add('hidden');
  });

  updateBetBtn();
}

function startPolling() {
  if(pollTimer) clearInterval(pollTimer);
  pollTimer=setInterval(tick,100);
  tick();
}

async function tick() {
  try {
    const d=await API.round();
    roundState=d;
    $('db-warn').classList.remove('show');
    renderRoundUI(d);
  } catch(e) {
    if(!$('db-warn').classList.contains('show')){
      $('db-warn').classList.add('show');
      $('db-warn').textContent='⚠ Live pool syncing… timer still works. ('+e.message+')';
    }
    renderRoundUI(localRoundInfo());
  }
}

function syncBetUI(bet) {
  $('bet-btn').disabled=true;
  $('bet-btn').innerHTML=`<i class="ti ti-lock"></i> PKR ${bet.amount} on #${bet.number}`;
  document.querySelectorAll('.dice-card').forEach(c=>{
    c.classList.toggle('sel',parseInt(c.dataset.n)===bet.number);
    c.classList.add('off');
  });
  updateSlip();
}

function resetRound() {
  selectedNum=null; betAmount=0; betLocked=false;
  resultShown=null; diceShown=null;
  $('bet-btn').disabled=true;
  $('bet-btn').innerHTML='<i class="ti ti-check"></i> Confirm Bet';
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));
  $('custom-bet').value='';
  document.querySelectorAll('.dice-card').forEach(c=>c.classList.remove('sel','win','off'));
  document.querySelectorAll('.dice-hot').forEach(b=>b.remove());
  updateSlip(); refreshUser();
}

// ── Dice roll + result (premium GSAP) ──
const faceRotations = {
  1: { x: 0, y: 0 }, 2: { x: 0, y: -90 }, 3: { x: -90, y: 0 },
  4: { x: 90, y: 0 }, 5: { x: 0, y: 90 }, 6: { x: 0, y: 180 }
};

function startDiceRoll(winner, roundId) {
  if (isStaffUser()) { diceShown = roundId; return; }
  diceShown = roundId;
  $('dice-overlay').classList.add('show');
  const cube = $('dice-cube');
  $('roll-msg').textContent = 'Rolling…';
  if (typeof gsap === 'undefined') {
    setTimeout(() => stopDiceRoll(winner, roundId), 3500);
    return;
  }
  gsap.set(cube, { rotationX: 15, rotationY: 20, scale: 1 });
  gsap.to(cube, {
    rotationX: '+=720', rotationY: '+=540', rotationZ: '+=360',
    duration: 3.5, ease: 'power2.inOut',
    onUpdate() { renderAllDiceFaces(Math.ceil(Math.random() * 6)); },
    onComplete() { stopDiceRoll(winner, roundId); }
  });
}

function stopDiceRoll(winner, roundId) {
  const cube = $('dice-cube');
  const rot = faceRotations[winner] || faceRotations[1];
  if (typeof gsap !== 'undefined') {
    gsap.to(cube, {
      rotationX: rot.x, rotationY: rot.y, duration: 1.2, ease: 'elastic.out(1, 0.6)',
      onComplete() {
        renderAllDiceFaces(winner);
        $('roll-msg').textContent = '✨ ' + winner + ' ✨';
        setTimeout(() => { $('dice-overlay').classList.remove('show'); showResult(winner, roundId); }, 900);
      }
    });
  } else {
    $('dice-overlay').classList.remove('show');
    showResult(winner, roundId);
  }
}

function showDiceRoll(winner, roundId) { startDiceRoll(winner, roundId); }

function showResult(winner, roundId) {
  if(resultShown===roundId) return;
  if (isStaffUser()) { resultShown = roundId; return; }
  resultShown=roundId;

  winHistory.unshift(winner);
  if(winHistory.length>20) winHistory.pop();
  buildTicker();
  updateResultsStrip();

  const myBet=roundState?.myBet;
  const won=myBet&&myBet.number===winner;

  $('res-num').textContent=winner;
  document.querySelectorAll('.dice-card').forEach(c=>{
    if(parseInt(c.dataset.n)===winner) c.classList.add('win');
  });

  const title=$('res-title'), desc=$('res-desc'), payout=$('res-payout'), emoji=$('res-emoji');

  if(won){
    emoji.textContent='🏆'; title.textContent='YOU WON!'; title.className='result-title win';
    const odds = window.GAME_CONFIG?.odds || 5;
    desc.textContent=`#${myBet.number} hit! PKR ${myBet.amount} × ${odds}`;
    payout.textContent='+ PKR '+(myBet.amount*odds).toLocaleString();
    payout.classList.remove('hidden');
    if(typeof confetti==='function') confetti({particleCount:150,spread:90,origin:{y:0.55},colors:['#f4d03f','#00e676','#fff','#d4af37']});
  } else if(myBet){
    emoji.textContent='💫'; title.textContent='Not This Time'; title.className='result-title lose';
    desc.textContent=`You: #${myBet.number} · Winner: #${winner} · Lost PKR ${myBet.amount}`;
    payout.classList.add('hidden');
  } else {
    emoji.textContent='⏱'; title.textContent='Round Complete'; title.className='result-title';
    desc.textContent=`Winning number was #${winner}`;
    payout.classList.add('hidden');
  }

  $('result-overlay').classList.add('show');
  if(typeof gsap!=='undefined') gsap.from('#result-modal',{scale:0.75,opacity:0,duration:0.5,ease:'back.out(1.7)'});
  refreshUser();
}

function updateResultsStrip() {
  const strip=$('results-strip');
  strip.innerHTML=winHistory.slice(0,15).map((n,i)=>
    `<div class="res-dot${i===0?' latest':''}">${n}</div>`
  ).join('');
}

function closeResult() { $('result-overlay').classList.remove('show'); }

// ── Admin sidebar sections ──
function switchAdminSection(name) {
  const allowed = document.querySelector(`.admin-nav-item[data-admin-section="${name}"]:not(.hidden)`);
  if (!allowed) return;

  document.querySelectorAll('.admin-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.adminSection === name);
  });
  document.querySelectorAll('.admin-panel').forEach(p => {
    if (p.classList.contains('admin-panel-disabled')) return;
    p.classList.toggle('active', p.dataset.panel === name);
  });

  if (name === 'roleManager') loadRoleManager();
  if (name === 'deposits') loadDepositQueries();
  if (name === 'withdrawals') loadWithdrawQueries();
  if (name === 'payments') initPaymentForm();
  if (name === 'cms') initCMSAdminForm();
  if (name === 'metrics') { animateEliteMetrics(); setTimeout(() => Object.values(adminCharts).forEach(c => c?.resize()), 100); }
}

// ── Tabs ──
function switchTab(name) {
  document.querySelectorAll('.dnav-item,.bnav-item').forEach(t=>{
    t.classList.toggle('active', t.dataset.tab===name);
  });
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const page=$('page-'+name);
  if(page) page.classList.add('active');
  document.querySelector('.shell')?.classList.toggle('shell-admin', name === 'admin');
  document.body.classList.toggle('admin-mode', name === 'admin');

  if(name==='leaderboard') loadLeaderboard();
  if(name==='history'||name==='profile'||name==='referrals'||name==='wallet') refreshUser();
  if(name==='wallet') { loadMyDeposits(); loadMyWithdrawals(); }
  if(name==='admin') { initCMSAdminForm(); initPaymentForm(); loadAdmin(); switchAdminSection('metrics'); }
}

async function refreshUser() {
  try {
    const d = await DirectAuth.loadProfile();
    user = d.user; updateUserUI();
    renderHistory(d.history);
    renderReferrals(d.referrals);
  } catch(_){}
}

function renderHistory(history) {
  const el=$('hist-list');
  if(!history?.length){el.innerHTML='<p style="color:var(--dim);font-size:13px;padding:12px 0">No bets yet — start playing!</p>';return;}
  el.innerHTML=history.map(h=>`
    <div class="h-row">
      <div class="h-badge">${h.number}</div>
      <div style="flex:1">
        <div style="font-weight:600">${h.won?'Won':'Lost'} → #${h.winner}</div>
        <div style="font-size:11px;color:var(--dim)">Round #${h.roundId}</div>
      </div>
      <div style="font-weight:800;color:${h.won?'var(--green)':'var(--red)'}">${h.won?'+PKR '+h.payout:'-PKR '+h.amount}</div>
    </div>
  `).join('');
}

function renderReferrals(refs) {
  $('ref-count').textContent=refs?.length||0;
  const el=$('ref-list');
  if(!refs?.length){el.innerHTML='<p style="color:var(--dim);font-size:13px">No referrals yet</p>';return;}
  el.innerHTML=refs.map(r=>`
    <div class="h-row"><span>${r.username}</span><span style="color:var(--green);font-weight:700">+PKR ${r.bonus}</span></div>
  `).join('');
}

async function loadLeaderboard() {
  try {
    const {leaderboard}=await API.leaderboard();
    const top3=leaderboard.slice(0,3);
    const order=[1,0,2];
    $('podium').innerHTML=order.map((i,idx)=>{
      const u=top3[i]; if(!u) return '';
      const cls=['p2','p1','p3'][idx];
      return `<div class="podium-item ${cls}"><div class="bar"><div class="podium-av">${u.username.substring(0,2).toUpperCase()}</div></div><div class="podium-name">${u.username}</div><div class="podium-amt">PKR ${Number(u.balance).toLocaleString()}</div></div>`;
    }).join('');

    $('lb-list').innerHTML=leaderboard.map((u,i)=>`
      <div class="lb-row ${u.username===user?.username?'lb-you':''}">
        <div class="lb-pos">${i+1}</div>
        <div class="avatar" style="width:32px;height:32px;font-size:10px">${u.username.substring(0,2).toUpperCase()}</div>
        <span style="flex:1;font-weight:${u.username===user?.username?700:400}">${u.username}</span>
        <span style="color:var(--gold2);font-weight:700">PKR ${Number(u.balance).toLocaleString()}</span>
      </div>
    `).join('');
  } catch(e){toast(e.message);}
}

function copyRef() {
  const link=location.origin+location.pathname+'?ref='+user.referralCode;
  navigator.clipboard.writeText(link).then(()=>toast('Referral link copied!',true));
}

async function loadAdmin() {
  if(!window.currentUser?.permissions?.can_view_admin) return;
  const perms = window.currentUser.permissions;
  try {
    const d=await API.admin('GET');

    if (perms.can_view_financials && d.house) {
      const p=d.house.profit;
      const today=d.house.todayProfit;
      const rounds=d.rounds||[];
      const recentPool=rounds.reduce((s,r)=>s+r.pool,0);
      const recentHouse=rounds.reduce((s,r)=>s+r.housePL,0);
      const recentPaid=Math.max(0,recentPool-recentHouse);
      const margin=recentPool>0?((recentHouse/recentPool)*100).toFixed(1):'0.0';

      setDashText('dash-total-profit','PKR '+p.toLocaleString());
      setDashText('dash-today-pl','PKR '+today.toLocaleString());
      setDashText('dash-margin',margin+'%');
      setDashText('dash-total-pool','PKR '+recentPool.toLocaleString());
      setDashText('dash-users', d.usersCount ?? (d.users?.length || 0));
      setDashText('dash-payouts','PKR '+recentPaid.toLocaleString());
      setDashText('dash-rounds-sub',d.house.totalRounds+' rounds played');
      setDashText('pl-pool','PKR '+recentPool.toLocaleString());
      setDashText('pl-paid','PKR '+recentPaid.toLocaleString());
      setDashText('pl-net','PKR '+p.toLocaleString());
      setDashText('pl-margin',margin+'%');

      const pel=$('house-profit'); if(pel){pel.textContent='PKR '+p.toLocaleString();pel.className='val '+(p>=0?'pos':'neg');}
      const uc=$('admin-users-count'); if(uc) uc.textContent = d.usersCount ?? (d.users?.length || 0);
      const rc=$('admin-rounds-count'); if(rc) rc.textContent=d.house.totalRounds;
      const td=$('admin-today'); if(td) td.textContent='PKR '+today.toLocaleString();

      renderAdminCharts(d);
      animateEliteMetrics();
    }

    if (d.currentExposure) {
      const max=Math.max(...d.currentExposure,1);
      const expEl = $('exp-chart');
      if (expEl) expEl.innerHTML=d.currentExposure.map((b,i)=>{
        const h=Math.max(4,b/max*70);
        const cls=b===0?'safe':b>max*0.5?'hot':'mid';
        return `<div class="exp-col"><div class="exp-bar ${cls}" style="height:${h}px"></div><span>${i+1}<br>${b}</span></div>`;
      }).join('');
    }

    if (perms.can_manage_rounds && d.rounds?.length) {
      $('admin-rounds-tbl').innerHTML=d.rounds.map(r=>`
      <tr><td>#${r.id}</td><td>PKR ${r.pool.toLocaleString()}</td><td>#${r.winner}</td>
      <td style="color:${r.housePL>=0?'var(--green)':'var(--red)'}">${r.housePL>=0?'+':''}${r.housePL}</td></tr>
    `).join('');
    }

    const usersTbl = $('admin-users-tbl');
    if (usersTbl) {
      if (perms.can_manage_users && d.users?.length) {
        usersTbl.innerHTML = d.users.map(u => `
      <tr><td>${u.username}</td><td>PKR ${Number(u.balance).toLocaleString()}</td><td>${u.wins}</td>
      <td>${perms.can_add_funds ? `<button class="btn btn-outline btn-sm" onclick="adminFund('${u.username.replace(/'/g, "\\'")}')">+Fund</button>` : ''}</td></tr>
    `).join('');
      } else if (perms.can_manage_users) {
        usersTbl.innerHTML = '<tr><td colspan="4" style="color:var(--dim);padding:16px">No users yet</td></tr>';
      } else {
        usersTbl.innerHTML = '<tr><td colspan="4" style="color:var(--dim);padding:16px">User list restricted — Owner only</td></tr>';
      }
    }

    await loadDepositQueries();
    initPaymentForm();
    loadRoleManager();
  } catch(e){toast(e.message);}
}

function adminFund(u){$('fund-user').value=u;}

async function adminAddFunds() {
  if(!window.currentUser?.permissions?.can_add_funds) return toast('No permission');
  const uname = $('fund-user').value.trim();
  const amt = parseInt($('fund-amt').value);
  if (!uname || !amt || amt <= 0) return toast('Enter username and amount');
  try {
    await API.admin('POST',{username:uname,amount:amt});
    toast('PKR '+amt.toLocaleString()+' added to '+uname+'!',true);
    $('fund-amt').value=''; loadAdmin();
  } catch(e){toast(e.message);}
}

// ── Deposits (Easypaisa / JazzCash) ──
function openDepositModal() {
  if (isStaffUser()) return toast('Staff accounts use Admin → Add funds');
  updatePayDetailsUI();
  $('deposit-overlay').classList.add('show');
  $('deposit-amount').value = '';
  $('deposit-screenshot').value = '';
  $('deposit-preview').classList.add('hidden');
  $('deposit-preview').innerHTML = '';
}

function closeDepositModal() { $('deposit-overlay').classList.remove('show'); }

function selectPayMethod(method) {
  depositMethod = method;
  document.querySelectorAll('.pay-method').forEach(b => b.classList.toggle('on', b.dataset.method === method));
  updatePayDetailsUI();
}

function updatePayDetailsUI() {
  const acc = Deposits.getAccounts();
  const m = depositMethod === 'jazzcash' ? acc.jazzcash : acc.easypaisa;
  const label = depositMethod === 'jazzcash' ? 'JazzCash' : 'Easypaisa';
  $('pay-details-label').textContent = label;
  $('pay-detail-name').textContent = m.name || 'Not configured — ask admin';
  $('pay-detail-number').textContent = m.number || '—';
}

function copyPayNumber() {
  const n = $('pay-detail-number').textContent;
  if (n && n !== '—') navigator.clipboard.writeText(n).then(() => toast('Account number copied!', true));
}

$('deposit-screenshot') && $('deposit-screenshot').addEventListener('change', async function() {
  const prev = $('deposit-preview');
  const hint = $('deposit-size-hint');
  if (!this.files?.[0]) {
    prev.classList.add('hidden');
    hint?.classList.add('hidden');
    return;
  }
  try {
    const { dataUrl, sizeKB } = await ImageCompress.compressFile(this.files[0], { maxKB: 120 });
    prev.innerHTML = `<img src="${dataUrl}" alt="Preview" />`;
    prev.classList.remove('hidden');
    if (hint) {
      hint.textContent = `Compressed to ~${sizeKB} KB (optimized for admin review)`;
      hint.classList.remove('hidden');
    }
  } catch (e) {
    toast(e.message);
  }
});

function openProofLightbox(id, label) {
  const src = _proofCache[id];
  if (!src) return;
  $('proof-lightbox-img').src = src;
  $('proof-lightbox-meta').textContent = label || '';
  $('proof-lightbox').classList.add('show');
}

function closeProofLightbox() {
  $('proof-lightbox').classList.remove('show');
  $('proof-lightbox-img').src = '';
}

async function submitDepositRequest() {
  try {
    const file = $('deposit-screenshot').files?.[0];
    if (!file) return toast('Upload payment screenshot');
    await Deposits.submit({
      method: depositMethod,
      amount: $('deposit-amount').value,
      screenshotFile: file
    });
    toast('Deposit sent! Screenshot compressed & submitted.', true);
    closeDepositModal();
    loadMyDeposits();
  } catch (e) { toast(e.message); }
}

async function loadMyDeposits() {
  const el = $('my-deposit-list');
  if (!el || isStaffUser()) return;
  try {
    const rows = await Deposits.fetchMyRequests();
    if (!rows.length) { el.innerHTML = '<p style="color:var(--muted);font-size:13px">No requests yet</p>'; return; }
    el.innerHTML = rows.map(r => `
      <div class="h-row">
        <div style="flex:1">
          <div style="font-weight:600">${r.method === 'easypaisa' ? 'Easypaisa' : 'JazzCash'} · PKR ${Number(r.amount).toLocaleString()}</div>
          <div style="font-size:11px;color:var(--dim)">${new Date(r.created_at).toLocaleString()}</div>
        </div>
        <span class="dep-status dep-${r.status}">${r.status}</span>
      </div>
    `).join('');
  } catch (_) {}
}

function initPaymentForm() {
  if (!window.currentUser?.permissions?.can_add_funds) return;
  const g = window.GAME_CONFIG || {};
  const epn = $('pay-ep-name'), epnum = $('pay-ep-num'), jcn = $('pay-jc-name'), jcnum = $('pay-jc-num');
  if (epn) epn.value = g.easypaisaName || '';
  if (epnum) epnum.value = g.easypaisaNumber || '';
  if (jcn) jcn.value = g.jazzcashName || '';
  if (jcnum) jcnum.value = g.jazzcashNumber || '';
}

async function savePaymentAccounts() {
  if (!window.currentUser?.permissions?.can_add_funds) return toast('No permission');
  try {
    await Deposits.savePaymentAccounts({
      'payment.easypaisa_name': $('pay-ep-name').value.trim(),
      'payment.easypaisa_number': $('pay-ep-num').value.trim(),
      'payment.jazzcash_name': $('pay-jc-name').value.trim(),
      'payment.jazzcash_number': $('pay-jc-num').value.trim()
    }, user?.username);
    toast('Payment accounts saved', true);
    updatePayDetailsUI();
  } catch (e) { toast(e.message); }
}

async function loadDepositQueries() {
  if (!window.currentUser?.permissions?.can_add_funds) return;
  const list = $('deposit-queries-list');
  const countEl = $('deposit-pending-count');
  if (!list) return;
  try {
    const rows = await Deposits.fetchPending();
    _proofCache = {};
    const count = rows.length;
    const totalAmt = rows.reduce((s, r) => s + Number(r.amount), 0);
    const withShots = rows.filter(r => r.screenshot_data).length;

    if (countEl) countEl.textContent = count;
    $('dep-stat-count') && ($('dep-stat-count').textContent = count);
    $('dep-stat-total') && ($('dep-stat-total').textContent = 'PKR ' + totalAmt.toLocaleString());
    $('dep-stat-screens') && ($('dep-stat-screens').textContent = withShots);

    const navBadge = $('deposit-pending-nav');
    if (navBadge) {
      navBadge.textContent = count;
      navBadge.style.display = count > 0 ? '' : 'none';
    }
    if (!rows.length) {
      list.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0">No pending deposits</p>';
      return;
    }
    list.innerHTML = rows.map(r => {
      const kb = r.screenshot_size_kb || ImageCompress.dataUrlSizeKB(r.screenshot_data);
      if (r.screenshot_data) _proofCache['d' + r.id] = r.screenshot_data;
      const method = r.method === 'easypaisa' ? 'Easypaisa' : 'JazzCash';
      return `
      <div class="deposit-query-card">
        <div class="dq-top">
          <div>
            <div class="dq-user">${r.username}</div>
            <div class="dq-meta">${method} · PKR ${Number(r.amount).toLocaleString()} · ${new Date(r.created_at).toLocaleString()}</div>
          </div>
          <div class="dq-actions">
            <button class="btn btn-primary btn-sm" style="width:auto" onclick="approveDeposit(${r.id})"><i class="ti ti-check"></i> Approve</button>
            <button class="btn btn-outline btn-sm" style="width:auto" onclick="rejectDeposit(${r.id})"><i class="ti ti-x"></i></button>
          </div>
        </div>
        ${r.screenshot_data ? `
          <div class="dq-proof-row">
            <button type="button" class="dq-thumb-btn" onclick="openProofLightbox('d${r.id}', '${r.username} · PKR ${r.amount} · ${kb} KB')">
              <img class="dq-thumb" src="${r.screenshot_data}" alt="Proof" />
              <span class="dq-kb-badge">${kb} KB</span>
              <span class="dq-view-label"><i class="ti ti-zoom-in"></i> View full</span>
            </button>
          </div>` : '<p class="dq-no-proof">No screenshot attached</p>'}
      </div>`;
    }).join('');
  } catch (e) { list.innerHTML = '<p class="alert-err show">'+e.message+'</p>'; }
}

async function approveDeposit(id) {
  if (!window.currentUser?.permissions?.can_add_funds) return;
  try {
    const res = await Deposits.approve(id, user.username);
    toast('Funded PKR '+res.amount.toLocaleString()+' → '+res.username, true);
    loadDepositQueries();
    loadAdmin();
  } catch (e) { toast(e.message); }
}

async function rejectDeposit(id) {
  if (!window.currentUser?.permissions?.can_add_funds) return;
  const note = prompt('Reason for rejection (optional):') || '';
  try {
    await Deposits.reject(id, user.username, note);
    toast('Deposit rejected');
    loadDepositQueries();
  } catch (e) { toast(e.message); }
}

function setupDepositRealtime() {
  if (!window.currentUser?.permissions?.can_add_funds) return;
  if (depositChannel) DirectAuth.db().removeChannel(depositChannel);
  depositChannel = Deposits.subscribePending(() => {
    loadDepositQueries();
    toast('New deposit request!', true);
  });
}

// ── Withdrawals ──
function openWithdrawModal() {
  if (isStaffUser()) return toast('Staff accounts cannot withdraw here');
  $('withdraw-overlay').classList.add('show');
  $('withdraw-amount').value = '';
  $('withdraw-name').value = '';
  $('withdraw-number').value = '';
}

function closeWithdrawModal() { $('withdraw-overlay').classList.remove('show'); }

function selectWithdrawMethod(method) {
  withdrawMethod = method;
  document.querySelectorAll('[data-wmethod]').forEach(b => b.classList.toggle('on', b.dataset.wmethod === method));
}

async function submitWithdrawRequest() {
  try {
    const res = await Withdrawals.submit({
      amount: $('withdraw-amount').value,
      accountName: $('withdraw-name').value,
      accountNumber: $('withdraw-number').value,
      method: withdrawMethod
    });
    user.balance = res.balance;
    updateUserUI();
    toast('Withdrawal submitted! PKR reserved from balance.', true);
    closeWithdrawModal();
    loadMyWithdrawals();
  } catch (e) { toast(e.message); }
}

async function loadMyWithdrawals() {
  const el = $('my-withdraw-list');
  if (!el || isStaffUser()) return;
  try {
    const rows = await Withdrawals.fetchMyRequests();
    if (!rows.length) {
      el.innerHTML = '<p style="color:var(--muted);font-size:13px">No withdrawal requests yet</p>';
      return;
    }
    el.innerHTML = rows.map(r => `
      <div class="h-row">
        <div style="flex:1">
          <div style="font-weight:600">${r.method === 'easypaisa' ? 'Easypaisa' : 'JazzCash'} · PKR ${Number(r.amount).toLocaleString()}</div>
          <div style="font-size:11px;color:var(--dim)">${r.account_name} · ${r.account_number}</div>
          <div style="font-size:11px;color:var(--dim)">${new Date(r.created_at).toLocaleString()}</div>
        </div>
        <span class="dep-status dep-${r.status === 'sent' ? 'approved' : r.status}">${r.status}</span>
      </div>
    `).join('');
  } catch (_) {}
}

async function loadWithdrawQueries() {
  if (!window.currentUser?.permissions?.can_withdraw_funds) return;
  const list = $('withdraw-queries-list');
  if (!list) return;
  try {
    const rows = await Withdrawals.fetchPending();
    const count = rows.length;
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);

    $('withdraw-pending-count') && ($('withdraw-pending-count').textContent = count);
    $('wd-stat-count') && ($('wd-stat-count').textContent = count);
    $('wd-stat-total') && ($('wd-stat-total').textContent = 'PKR ' + total.toLocaleString());
    const navBadge = $('withdraw-pending-nav');
    if (navBadge) {
      navBadge.textContent = count;
      navBadge.style.display = count > 0 ? '' : 'none';
    }

    if (!rows.length) {
      list.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0">No pending withdrawals</p>';
      return;
    }

    list.innerHTML = rows.map(r => {
      const method = r.method === 'easypaisa' ? 'Easypaisa' : 'JazzCash';
      return `
      <div class="deposit-query-card wd-card">
        <div class="dq-top">
          <div>
            <div class="dq-user">${r.username}</div>
            <div class="dq-meta">PKR ${Number(r.amount).toLocaleString()} · ${new Date(r.created_at).toLocaleString()}</div>
          </div>
        </div>
        <div class="wd-account-box">
          <div><span>Method</span><strong>${method}</strong></div>
          <div><span>Account name</span><strong>${r.account_name}</strong></div>
          <div><span>Account number</span><strong class="copyable" onclick="navigator.clipboard.writeText('${r.account_number}');toast('Copied!',true)">${r.account_number}</strong></div>
        </div>
        <div class="wd-admin-actions">
          <label class="field" style="margin:0">Upload payment proof (auto-compressed)
            <input type="file" id="wd-proof-${r.id}" accept="image/*" class="file-input" />
          </label>
          <div class="dq-actions">
            <button class="btn btn-primary btn-sm" style="width:auto" onclick="completeWithdrawal(${r.id})"><i class="ti ti-check"></i> Mark sent</button>
            <button class="btn btn-outline btn-sm" style="width:auto" onclick="rejectWithdrawal(${r.id})"><i class="ti ti-x"></i> Reject &amp; refund</button>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (e) { list.innerHTML = '<p class="alert-err show">' + e.message + '</p>'; }
}

async function completeWithdrawal(id) {
  if (!window.currentUser?.permissions?.can_withdraw_funds) return;
  const file = $('wd-proof-' + id)?.files?.[0];
  if (!file) return toast('Upload payment proof screenshot first');
  try {
    const res = await Withdrawals.markSent(id, user.username, file);
    toast(`Sent PKR ${res.amount.toLocaleString()} → ${res.username} (proof ${res.sizeKB} KB)`, true);
    loadWithdrawQueries();
  } catch (e) { toast(e.message); }
}

async function rejectWithdrawal(id) {
  if (!window.currentUser?.permissions?.can_withdraw_funds) return;
  const note = prompt('Reason for rejection (balance will be refunded):') || '';
  try {
    const res = await Withdrawals.reject(id, user.username, note);
    toast(`Refunded PKR ${res.refunded.toLocaleString()} → ${res.username}`, true);
    loadWithdrawQueries();
  } catch (e) { toast(e.message); }
}

function setupWithdrawRealtime() {
  if (!window.currentUser?.permissions?.can_withdraw_funds) return;
  if (withdrawChannel) DirectAuth.db().removeChannel(withdrawChannel);
  withdrawChannel = Withdrawals.subscribePending(() => {
    loadWithdrawQueries();
    toast('New withdrawal request!', true);
  });
}

const ROLE_OPTIONS = [
  { value: 'player', label: 'Player' },
  { value: 'operator', label: 'Operator (view only)' },
  { value: 'admin_assistant', label: 'Admin Assistant' },
  { value: 'admin', label: 'Admin' },
  { value: 'per_admin', label: 'Super Admin' },
  { value: 'owner', label: 'Owner' }
];

const STAFF_ROLES = ['owner', 'per_admin', 'admin', 'admin_assistant', 'operator'];

async function loadRoleManager() {
  const tbl = $('role-manager-tbl');
  if (!tbl || !window.currentUser?.permissions?.can_manage_roles) return;
  try {
    const { users } = await API.adminRoles('GET');
    tbl.innerHTML = (users || []).map(u => {
      const isYou = u.id === user?.id;
      const role = u.role || 'player';
      const opts = ROLE_OPTIONS.map(o =>
        `<option value="${o.value}" ${o.value === role ? 'selected' : ''}>${o.label}</option>`
      ).join('');
      return `<tr>
        <td class="${isYou ? 'role-you' : ''}">${u.username}${isYou ? ' (you)' : ''}</td>
        <td>PKR ${Number(u.balance).toLocaleString()}</td>
        <td>${role.replace(/_/g, ' ')}</td>
        <td><select id="role-sel-${u.id}" class="role-select">${opts}</select></td>
        <td><button class="btn btn-primary btn-sm" style="width:auto" onclick="saveUserRole('${u.id}','${u.username.replace(/'/g, "\\'")}')">Save</button></td>
      </tr>`;
    }).join('');
  } catch (e) {
    tbl.innerHTML = `<tr><td colspan="5" style="color:var(--red)">${e.message}</td></tr>`;
  }
}

async function saveUserRole(userId, username) {
  if (!window.currentUser?.permissions?.can_manage_roles) return toast('Only Owner can change roles');
  const sel = $('role-sel-' + userId);
  if (!sel) return;
  const newRole = sel.value;
  try {
    await API.adminRoles('POST', { userId, role: newRole });
    toast(username + ' → ' + newRole.replace(/_/g, ' '), true);
    if (userId === user?.id) {
      toast('Sign out and back in to apply your new role', true);
    }
    loadRoleManager();
    loadAdmin();
  } catch (e) { toast(e.message); }
}

// ── Exposure realtime ──
function updateExposureBars(summary) {
  if (!summary) return;
  const bets = [
    Number(summary.number_1_total) || 0, Number(summary.number_2_total) || 0,
    Number(summary.number_3_total) || 0, Number(summary.number_4_total) || 0,
    Number(summary.number_5_total) || 0, Number(summary.number_6_total) || 0
  ];
  if (roundState) { roundState.bets = bets; roundState.pool = Number(summary.total_pool) || bets.reduce((a,b)=>a+b,0); }
  const maxBet = Math.max(...bets, 1);
  const nonzero = bets.filter(b => b > 0);
  const minBet = nonzero.length ? Math.min(...nonzero) : 0;
  bets.forEach((b, i) => {
    const el = $('pool-' + (i + 1));
    if (el) el.textContent = 'PKR ' + b.toLocaleString();
    const fill = $('exp-' + (i + 1));
    if (fill) {
      fill.style.width = Math.round((b / maxBet) * 100) + '%';
      fill.style.background = b === minBet && b < maxBet ? 'var(--brand-secondary)' : b === maxBet && maxBet > 0 ? 'var(--brand-danger)' : 'var(--brand-primary)';
    }
    const safe = $('safe-' + (i + 1));
    if (b === minBet && b > 0 && safe) { safe.classList.remove('hidden'); safe.textContent = 'SAFE'; }
    else if (safe) safe.classList.add('hidden');
  });
}

function setupExposureRealtime() {
  if (!window.BATIG_CONFIG?.supabaseUrl) return;
  const db = DirectAuth.db();
  if (exposureChannel) db.removeChannel(exposureChannel);
  exposureChannel = db.channel('round_exposure')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'round_bets_summary' }, payload => {
      if (payload.new) updateExposureBars(payload.new);
    })
    .subscribe();
  const roundId = Math.floor(Date.now() / 60000);
  db.from('round_bets_summary').select('*').eq('round_id', roundId).maybeSingle()
    .then(({ data }) => { if (data) updateExposureBars(data); })
    .catch(() => {});
}

// ── CMS admin panel ──
async function saveCMSTheme() {
  try {
    const keys = ['theme.color.brand_primary', 'theme.color.brand_secondary', 'theme.color.bg_base', 'theme.color.brand_accent'];
    for (const k of keys) {
      const inp = document.querySelector(`[data-cms-key="${k}"]`);
      if (inp) await CMS.save(k, inp.value, user?.username);
    }
    toast('Theme saved — live for all users', true);
  } catch (e) { toast(e.message); }
}

async function saveCMSGame() {
  try {
    const keys = ['game.odds_multiplier', 'game.min_bet', 'game.max_bet', 'game.welcome_bonus', 'game.referral_bonus'];
    for (const k of keys) {
      const inp = document.querySelector(`[data-cms-key="${k}"]`);
      if (inp) await CMS.save(k, inp.value, user?.username);
    }
    toast('Game settings saved', true);
  } catch (e) { toast(e.message); }
}

async function saveCMSContent() {
  try {
    const keys = ['content.site_name', 'content.tagline', 'content.deposit_contact', 'content.withdraw_info'];
    for (const k of keys) {
      const inp = document.querySelector(`[data-cms-key="${k}"]`);
      if (inp) await CMS.save(k, inp.value, user?.username);
    }
    toast('Content updated', true);
  } catch (e) { toast(e.message); }
}

async function saveCMSLimits() {
  try {
    const maint = document.getElementById('cms-maintenance');
    const betting = document.getElementById('cms-betting-open');
    const maxExp = document.querySelector('[data-cms-key="limits.max_exposure_per_number"]');
    if (maint) await CMS.save('limits.maintenance_mode', maint.checked ? 'true' : 'false', user?.username);
    if (betting) await CMS.save('limits.betting_open', betting.checked ? 'true' : 'false', user?.username);
    if (maxExp) await CMS.save('limits.max_exposure_per_number', maxExp.value, user?.username);
    toast('Limits updated', true);
  } catch (e) { toast(e.message); }
}

function initCMSAdminForm() {
  if (!window.GAME_CONFIG) return;
  document.querySelectorAll('[data-cms-key]').forEach(inp => {
    const k = inp.dataset.cmsKey;
    const gc = window.GAME_CONFIG;
    const map = {
      'theme.color.brand_primary': getComputedStyle(document.documentElement).getPropertyValue('--brand-primary').trim() || '#f4d03f',
      'game.odds_multiplier': gc.odds, 'game.min_bet': gc.minBet, 'game.max_bet': gc.maxBet,
      'game.welcome_bonus': gc.welcomeBonus, 'game.referral_bonus': gc.referralBonus,
      'content.site_name': gc.siteName, 'content.tagline': gc.tagline,
      'content.deposit_contact': gc.depositContact, 'content.withdraw_info': gc.withdrawInfo,
      'limits.max_exposure_per_number': gc.maxExposure
    };
    if (map[k] !== undefined && inp.type !== 'checkbox') inp.value = map[k];
  });
  const maint = document.getElementById('cms-maintenance');
  const betting = document.getElementById('cms-betting-open');
  if (maint) maint.checked = !!window.GAME_CONFIG.maintenanceMode;
  if (betting) betting.checked = window.GAME_CONFIG.bettingOpen !== false;
}

// ── Init ──
async function init() {
  initParticles();
  checkSetup();
  await CMS.load().catch(() => {});

  const ref=new URLSearchParams(location.search).get('ref');
  if(ref){showAuth('register');$('reg-referral').value=ref;}

  if (DirectAuth.getSession() && API.token) {
    try {
      const profile = await DirectAuth.loadProfile();
      await enterApp(profile.user);
      renderHistory(profile.history);
      renderReferrals(profile.referrals);
      return;
    } catch (_) { DirectAuth.clearSession(); }
  } else if (DirectAuth.getSession()) {
    DirectAuth.clearSession();
  }

  $('loader').classList.add('hidden');
  showAuth('login');
  if(typeof gsap!=='undefined'){
    gsap.to('#login-card',{opacity:1,y:0,duration:0.7,ease:'power3.out',delay:0.1});
  } else $('login-card').style.opacity=1;
}

document.addEventListener('DOMContentLoaded', init);

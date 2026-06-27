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

const $ = id => document.getElementById(id);

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
  user=u;
  $('screen-login').classList.add('hidden');
  $('screen-register').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('loader').classList.add('hidden');

  await CMS.load().catch(() => {});

  const perms = await ROLES.fetchPermissions(u.role || 'player');
  window.currentUser = { ...u, permissions: perms };
  ROLES.buildAdminPanel(u.role || 'player', perms);

  const ini=(u.username||'??').substring(0,2).toUpperCase();
  $('nav-avatar').textContent=ini;
  $('profile-avatar').textContent=ini;

  buildDiceRow(); buildChips(); renderAllDiceFaces(1);
  updateUserUI(); buildTicker();
  setupExposureRealtime();
  startPolling();

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
    const d = await DirectAuth.placeBet({ number: selectedNum, amount: betAmount });
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

    if(d.sec>=LOCK_END&&d.winner&&diceShown!==d.roundId) startDiceRoll(d.winner,d.roundId);
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

// ── Tabs ──
function switchTab(name) {
  document.querySelectorAll('.dnav-item,.bnav-item').forEach(t=>{
    t.classList.toggle('active', t.dataset.tab===name);
  });
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const page=$('page-'+name);
  if(page) page.classList.add('active');

  if(name==='leaderboard') loadLeaderboard();
  if(name==='history'||name==='profile'||name==='referrals'||name==='wallet') refreshUser();
  if(name==='admin') { initCMSAdminForm(); loadAdmin(); }
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
  try {
    const d=await API.admin('GET');
    const p=d.house.profit;
    const pel=$('house-profit');
    pel.textContent='PKR '+p.toLocaleString();
    pel.className='val '+(p>=0?'pos':'neg');
    $('admin-users-count').textContent=d.users.length;
    $('admin-rounds-count').textContent=d.house.totalRounds;
    $('admin-today').textContent='PKR '+d.house.todayProfit.toLocaleString();

    const max=Math.max(...d.currentExposure,1);
    $('exp-chart').innerHTML=d.currentExposure.map((b,i)=>{
      const h=Math.max(4,b/max*70);
      const cls=b===0?'safe':b>max*0.5?'hot':'mid';
      return `<div class="exp-col"><div class="exp-bar ${cls}" style="height:${h}px"></div><span>${i+1}<br>${b}</span></div>`;
    }).join('');

    $('admin-rounds-tbl').innerHTML=d.rounds.map(r=>`
      <tr><td>#${r.id}</td><td>PKR ${r.pool.toLocaleString()}</td><td>#${r.winner}</td>
      <td style="color:${r.housePL>=0?'var(--green)':'var(--red)'}">${r.housePL>=0?'+':''}${r.housePL}</td></tr>
    `).join('');

    $('admin-users-tbl').innerHTML=d.users.map(u=>`
      <tr><td>${u.username}</td><td>PKR ${Number(u.balance).toLocaleString()}</td><td>${u.wins}</td>
      <td><button class="btn btn-outline btn-sm" onclick="adminFund('${u.username}')">+Fund</button></td></tr>
    `).join('');
  } catch(e){toast(e.message);}
}

function adminFund(u){$('fund-user').value=u;}

async function adminAddFunds() {
  if(!window.currentUser?.permissions?.can_add_funds) return toast('No permission');
  try {
    await API.admin('POST',{username:$('fund-user').value.trim(),amount:parseInt($('fund-amt').value)});
    toast('Funds added!',true); $('fund-amt').value=''; loadAdmin();
  } catch(e){toast(e.message);}
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

  if(DirectAuth.getSession()){
    try {
      const profile = await DirectAuth.loadProfile();
      await enterApp(profile.user);
      renderHistory(profile.history);
      renderReferrals(profile.referrals);
      return;
    } catch(_){DirectAuth.clearSession();}
  }

  $('loader').classList.add('hidden');
  showAuth('login');
  if(typeof gsap!=='undefined'){
    gsap.to('#login-card',{opacity:1,y:0,duration:0.7,ease:'power3.out',delay:0.1});
  } else $('login-card').style.opacity=1;
}

document.addEventListener('DOMContentLoaded', init);

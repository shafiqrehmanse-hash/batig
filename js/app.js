/* BATIG Elite App */
const BET_AMOUNTS = [50, 100, 200, 500, 1000];
const BETTING_SEC = 45;
const LOCKED_SEC = 5;

let user = null;
let selectedNum = null;
let betAmount = 0;
let betLocked = false;
let roundState = null;
let pollTimer = null;
let resultShown = null;
let diceShown = null;

const $ = id => document.getElementById(id);

// ── Background canvas ──
function initBg() {
  const canvas = $('bg-canvas');
  const ctx = canvas.getContext('2d');
  let w, h, particles;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      a: Math.random() * 0.4 + 0.1
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(232,185,35,${p.a})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  draw();
}

// ── Dice 3D helpers ──
const dotMap = { 1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] };

function renderDots(id, val) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = '';
  const p = dotMap[val] || [];
  for (let i = 0; i < 9; i++) {
    const d = document.createElement('div');
    d.className = 'ddot' + (p.includes(i) ? '' : ' h');
    el.appendChild(d);
  }
}

function renderAllDiceFaces(n) {
  const opp = {1:6,2:5,3:4,4:3,5:2,6:1};
  renderDots('df-front', n);
  renderDots('df-back', opp[n]);
  renderDots('df-right', n <= 3 ? n+1 : n-1);
  renderDots('df-left', opp[n <= 3 ? n+1 : n-1]);
  renderDots('df-top', n <= 2 ? 3 : 2);
  renderDots('df-bottom', n <= 2 ? 4 : 5);
}

// ── UI helpers ──
function toast(msg, ok) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (ok ? ' ok' : '');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function showAlert(id, msg) {
  const el = $(id);
  el.textContent = msg;
  el.classList.add('show');
}

function hideAlerts() {
  document.querySelectorAll('.alert').forEach(a => a.classList.remove('show'));
}

function animBalance(el, to) {
  const from = parseInt(el.textContent.replace(/,/g, '')) || 0;
  if (typeof gsap !== 'undefined') {
    gsap.to({ val: from }, {
      val: to, duration: 0.8, ease: 'power2.out',
      onUpdate() { el.textContent = Math.round(this.targets()[0].val).toLocaleString(); }
    });
  } else {
    el.textContent = to.toLocaleString();
  }
}

// ── Auth ──
function showAuth(which) {
  $('screen-login').classList.toggle('hidden', which !== 'login');
  $('screen-register').classList.toggle('hidden', which !== 'register');
  $('app').classList.add('hidden');

  const panel = which === 'login' ? $('login-panel') : $('register-panel');
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(panel, { opacity: 0, y: 50, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out' });
  }
}

async function doLogin() {
  hideAlerts();
  try {
    const data = await API.login({
      username: $('login-user').value.trim(),
      password: $('login-pass').value
    });
    API.setToken(data.token);
    await enterApp(data.user);
  } catch (e) {
    showAlert('login-error', e.message);
  }
}

async function doRegister() {
  hideAlerts();
  try {
    const data = await API.register({
      username: $('reg-user').value.trim(),
      password: $('reg-pass').value,
      phone: $('reg-phone').value.trim(),
      referralCode: $('reg-referral').value.trim()
    });
    API.setToken(data.token);
    if (data.referralBonus) toast('Referral bonus PKR ' + data.referralBonus + ' sent!', true);
    await enterApp(data.user);
  } catch (e) {
    showAlert('register-error', e.message);
  }
}

function doLogout() {
  API.setToken(null);
  user = null;
  clearInterval(pollTimer);
  $('app').classList.add('hidden');
  showAuth('login');
}

async function enterApp(u) {
  user = u;
  $('screen-login').classList.add('hidden');
  $('screen-register').classList.add('hidden');
  $('app').classList.remove('hidden');

  const init = user.username.substring(0, 2).toUpperCase();
  $('nav-avatar').textContent = init;
  $('admin-tab').classList.toggle('hidden', !user.isAdmin);

  buildDiceBoard();
  buildChips();
  renderAllDiceFaces(1);
  updateUserUI();

  if (typeof gsap !== 'undefined') {
    gsap.fromTo('#app', { opacity: 0 }, { opacity: 1, duration: 0.6 });
    gsap.from('.topbar', { y: -30, opacity: 0, duration: 0.5, delay: 0.1 });
  }

  startPolling();
  $('app-loader').classList.add('hidden');
}

function updateUserUI() {
  if (!user) return;
  animBalance($('nav-balance'), user.balance);
  $('profile-avatar').textContent = user.username.substring(0, 2).toUpperCase();
  $('profile-name').textContent = user.username;
  $('profile-sub').textContent = 'Member since ' + new Date(user.createdAt).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' });
  $('stat-balance').textContent = user.balance.toLocaleString();
  $('stat-wins').textContent = user.wins;
  $('stat-rounds').textContent = user.rounds;
  $('my-referral-code').textContent = user.referralCode;
}

// ── Game UI ──
function buildDiceBoard() {
  const board = $('dice-board');
  board.innerHTML = '';
  for (let n = 1; n <= 6; n++) {
    const tile = document.createElement('div');
    tile.className = 'dice-tile';
    tile.dataset.n = n;
    tile.innerHTML = `
      <div class="dice-check"><i class="ti ti-check"></i></div>
      <div class="dice-face">${n}</div>
      <div class="dice-pool" id="pool-${n}">PKR 0</div>
    `;
    tile.onclick = () => pickNum(n);
    board.appendChild(tile);
  }
}

function buildChips() {
  const row = $('chip-row');
  row.innerHTML = '';
  BET_AMOUNTS.forEach(amt => {
    const c = document.createElement('button');
    c.className = 'chip';
    c.textContent = 'PKR ' + amt;
    c.onclick = () => {
      document.querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
      c.classList.add('on');
      betAmount = amt;
      $('custom-bet').value = '';
      updateBetBtn();
    };
    row.appendChild(c);
  });
}

function setCustomBet() {
  const v = parseInt($('custom-bet').value);
  if (v >= 10) {
    betAmount = v;
    document.querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
    updateBetBtn();
  }
}

function pickNum(n) {
  if (betLocked || !roundState || roundState.phase !== 'betting') return;
  selectedNum = n;
  document.querySelectorAll('.dice-tile').forEach(t => {
    t.classList.toggle('picked', parseInt(t.dataset.n) === n);
  });
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(`.dice-tile[data-n="${n}"]`, { scale: 0.9 }, { scale: 1, duration: 0.35, ease: 'back.out(2)' });
  }
  updateBetBtn();
}

function updateBetBtn() {
  const btn = $('bet-btn');
  const ok = selectedNum && betAmount > 0 && !betLocked && roundState?.phase === 'betting';
  btn.disabled = !ok;
}

async function placeBet() {
  try {
    const data = await API.bet({ number: selectedNum, amount: betAmount });
    betLocked = true;
    user.balance = data.balance;
    animBalance($('nav-balance'), user.balance);

    const btn = $('bet-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="ti ti-lock"></i> Locked — PKR ${betAmount} on #${selectedNum}`;

    $('no-bet').classList.add('hidden');
    $('bet-preview').classList.remove('hidden');
    $('bet-num').textContent = selectedNum;
    $('bet-amt').textContent = 'PKR ' + betAmount.toLocaleString();

    document.querySelectorAll('.dice-tile').forEach(t => t.classList.add('off'));
    toast('Bet locked in!', true);
  } catch (e) {
    toast(e.message);
  }
}

// ── Round polling ──
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(tick, 500);
  tick();
}

async function tick() {
  try {
    $('db-banner').classList.remove('show');
    const data = await API.round();
    roundState = data;

    $('utc-clock').textContent = new Date(data.utc).toISOString().substr(11, 8) + ' UTC';
    $('round-tag').textContent = 'Round #' + data.roundId;

    const phaseEl = $('phase-tag');
    const timerVal = $('timer-val');
    const timerFill = $('timer-fill');
    const timerLbl = $('timer-lbl');

    if (data.phase === 'betting') {
      const left = BETTING_SEC - data.sec;
      phaseEl.textContent = 'BETTING OPEN';
      phaseEl.className = 'phase-tag phase-betting';
      timerLbl.textContent = 'Place your bet';
      timerVal.textContent = String(left).padStart(2, '0') + 's';
      timerVal.classList.toggle('urgent', left <= 10);
      timerFill.style.width = (left / BETTING_SEC * 100) + '%';
      timerFill.classList.toggle('urgent', left <= 10);

      if (data.myBet && !betLocked) {
        selectedNum = data.myBet.number;
        betAmount = data.myBet.amount;
        betLocked = true;
        syncBetUI(data.myBet);
      }
    } else if (data.phase === 'locked') {
      const left = BETTING_SEC + LOCKED_SEC - data.sec;
      phaseEl.textContent = 'BETS LOCKED';
      phaseEl.className = 'phase-tag phase-locked';
      timerLbl.textContent = 'Dice rolling soon';
      timerVal.textContent = String(left).padStart(2, '0') + 's';
      timerVal.classList.add('urgent');
      timerFill.style.width = (left / LOCKED_SEC * 100) + '%';
      timerFill.classList.add('urgent');
    } else {
      phaseEl.textContent = 'DICE ROLLING';
      phaseEl.className = 'phase-tag phase-rolling';
      timerLbl.textContent = 'Revealing winner';
      timerVal.textContent = String(data.secLeft).padStart(2, '0') + 's';
      timerFill.style.width = (data.secLeft / 10 * 100) + '%';

      if (data.resolved && data.winner && diceShown !== data.roundId) {
        showDiceRoll(data.winner, data.roundId);
      }
    }

    // New round reset
    if (data.phase === 'betting' && data.sec < 2 && resultShown === data.roundId - 1) {
      resetRound();
    }

    data.bets.forEach((b, i) => {
      const el = $('pool-' + (i + 1));
      if (el) el.textContent = 'PKR ' + b.toLocaleString();
    });

    $('pool-total').textContent = 'PKR ' + data.pool.toLocaleString();
    $('pool-players').textContent = data.players;
    if (data.lastWinner) $('last-winner').textContent = '#' + data.lastWinner;

    updateBetBtn();
  } catch (e) {
    $('db-banner').classList.add('show');
    $('db-banner').textContent = 'Database not connected. Set up Supabase + Vercel env vars. (' + e.message + ')';
  }
}

function syncBetUI(bet) {
  $('no-bet').classList.add('hidden');
  $('bet-preview').classList.remove('hidden');
  $('bet-num').textContent = bet.number;
  $('bet-amt').textContent = 'PKR ' + bet.amount.toLocaleString();
  $('bet-btn').disabled = true;
  $('bet-btn').innerHTML = `<i class="ti ti-lock"></i> Locked — PKR ${bet.amount} on #${bet.number}`;
  document.querySelectorAll('.dice-tile').forEach(t => {
    t.classList.toggle('picked', parseInt(t.dataset.n) === bet.number);
    t.classList.add('off');
  });
}

function resetRound() {
  selectedNum = null;
  betAmount = 0;
  betLocked = false;
  resultShown = null;
  diceShown = null;

  $('bet-btn').disabled = true;
  $('bet-btn').innerHTML = '<i class="ti ti-check"></i> Place Bet';
  $('no-bet').classList.remove('hidden');
  $('bet-preview').classList.add('hidden');
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  $('custom-bet').value = '';
  document.querySelectorAll('.dice-tile').forEach(t => t.classList.remove('picked', 'won', 'off'));

  refreshUser();
}

async function refreshUser() {
  try {
    const data = await API.me();
    user = data.user;
    updateUserUI();
    renderHistory(data.history);
    renderReferrals(data.referrals);
  } catch (_) {}
}

// ── Dice animation (GSAP) ──
function showDiceRoll(winner, roundId) {
  diceShown = roundId;
  const overlay = $('dice-overlay');
  const cube = $('dice-3d');
  overlay.classList.add('show');

  if (typeof gsap !== 'undefined') {
    gsap.set(cube, { rotationX: 20, rotationY: 30 });
    gsap.to(cube, {
      rotationX: '+=720', rotationY: '+=1080',
      duration: 2.5, ease: 'power2.inOut',
      onUpdate() {
        renderAllDiceFaces(Math.ceil(Math.random() * 6));
      },
      onComplete() {
        let count = 0;
        const iv = setInterval(() => {
          renderAllDiceFaces(Math.ceil(Math.random() * 6));
          count++;
          if (count >= 5) {
            clearInterval(iv);
            renderAllDiceFaces(winner);
            $('roll-msg').textContent = '✨ ' + winner + ' ✨';
            setTimeout(() => {
              overlay.classList.remove('show');
              showResult(winner, roundId);
            }, 1000);
          }
        }, 180);
      }
    });
  } else {
    setTimeout(() => {
      renderAllDiceFaces(winner);
      overlay.classList.remove('show');
      showResult(winner, roundId);
    }, 2500);
  }
}

function showResult(winner, roundId) {
  if (resultShown === roundId) return;
  resultShown = roundId;

  const myBet = roundState?.myBet;
  const won = myBet && myBet.number === winner;

  $('res-num').textContent = winner;
  document.querySelectorAll('.dice-tile').forEach(t => {
    if (parseInt(t.dataset.n) === winner) t.classList.add('won');
  });

  const title = $('res-title');
  const desc = $('res-desc');
  const payout = $('res-payout');
  const icon = $('res-icon');

  if (won) {
    icon.textContent = '🏆';
    title.textContent = 'You Won!';
    title.className = 'result-title win';
    desc.textContent = `PKR ${myBet.amount} on #${myBet.number} — 5× payout!`;
    payout.textContent = '+ PKR ' + (myBet.amount * 5).toLocaleString();
    payout.classList.remove('hidden');
    if (typeof confetti === 'function') {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#e8b923', '#f5d76e', '#10b981', '#fff'] });
    }
  } else if (myBet) {
    icon.textContent = '💫';
    title.textContent = 'Not This Time';
    title.className = 'result-title lose';
    desc.textContent = `You picked #${myBet.number}, winner was #${winner}`;
    payout.classList.add('hidden');
  } else {
    icon.textContent = '⏱';
    title.textContent = 'Round Over';
    title.className = 'result-title';
    desc.textContent = `Winning number: #${winner}`;
    payout.classList.add('hidden');
  }

  $('result-overlay').classList.add('show');
  if (typeof gsap !== 'undefined') {
    gsap.from('.result-modal', { scale: 0.8, opacity: 0, duration: 0.5, ease: 'back.out(1.7)' });
  }
  refreshUser();
}

function closeResult() {
  $('result-overlay').classList.remove('show');
}

// ── Tabs ──
function switchTab(name) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $('page-' + name).classList.add('active');
  if (name === 'leaderboard') loadLeaderboard();
  if (name === 'profile') refreshUser();
  if (name === 'admin') loadAdmin();
}

async function loadLeaderboard() {
  try {
    const { leaderboard } = await API.leaderboard();
    const list = $('lb-list');
    const medals = ['g1', 'g2', 'g3'];
    list.innerHTML = leaderboard.map((u, i) => `
      <div class="lb-row ${u.username === user?.username ? 'lb-you' : ''}">
        <div class="lb-pos ${medals[i] || ''}">${i + 1}</div>
        <div class="user-orb" style="width:32px;height:32px;font-size:10px">${u.username.substring(0,2).toUpperCase()}</div>
        <span style="flex:1">${u.username}${u.username === user?.username ? ' (You)' : ''}</span>
        <span style="color:var(--gold-light);font-weight:700">PKR ${Number(u.balance).toLocaleString()}</span>
      </div>
    `).join('');
  } catch (e) { toast(e.message); }
}

function renderHistory(history) {
  const el = $('user-history');
  if (!history?.length) { el.innerHTML = '<div style="color:var(--dim);font-size:13px">No rounds yet</div>'; return; }
  el.innerHTML = history.slice(0, 8).map(h => `
    <div class="hist-row">
      <div class="hist-num">${h.number}</div>
      <span style="color:${h.won ? 'var(--emerald)' : 'var(--muted)'}">${h.won ? 'Won' : 'Lost'} → #${h.winner}</span>
      <span style="margin-left:auto;font-weight:700;color:${h.won ? 'var(--emerald)' : 'var(--muted)'}">${h.won ? '+' + h.payout : '-' + h.amount}</span>
    </div>
  `).join('');
}

function renderReferrals(refs) {
  $('ref-count').textContent = refs?.length || 0;
  const el = $('ref-list');
  if (!refs?.length) {
    el.innerHTML = '<li style="color:var(--dim);font-size:13px;list-style:none">Share your code to earn PKR 100 per friend!</li>';
    return;
  }
  el.innerHTML = refs.map(r => `<li style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);list-style:none"><span>${r.username}</span><span style="color:var(--emerald)">+PKR ${r.bonus}</span></li>`).join('');
}

function copyRef() {
  const link = location.origin + location.pathname + '?ref=' + user.referralCode;
  navigator.clipboard.writeText(link).then(() => toast('Referral link copied!', true));
}

async function loadAdmin() {
  if (!user?.isAdmin) return;
  try {
    const data = await API.admin('GET');
    const profit = data.house.profit;
    const pel = $('house-profit');
    pel.textContent = 'PKR ' + profit.toLocaleString();
    pel.className = 'val ' + (profit >= 0 ? 'pos' : 'neg');
    $('admin-users-count').textContent = data.users.length;
    $('admin-rounds-count').textContent = data.house.totalRounds;
    $('admin-today').textContent = 'PKR ' + data.house.todayProfit.toLocaleString();

    const max = Math.max(...data.currentExposure, 1);
    $('exp-chart').innerHTML = data.currentExposure.map((b, i) => {
      const h = Math.max(4, b / max * 60);
      const cls = b === 0 ? 'safe' : b > max * 0.5 ? 'risk' : '';
      return `<div class="exp-col"><div class="exp-bar ${cls}" style="height:${h}px"></div><span>${i+1}<br>${b}</span></div>`;
    }).join('');

    $('admin-rounds-tbl').innerHTML = data.rounds.map(r => `
      <tr><td>#${r.id}</td><td>PKR ${r.pool.toLocaleString()}</td><td>#${r.winner}</td>
      <td style="color:${r.housePL >= 0 ? 'var(--emerald)' : 'var(--crimson)'}">${r.housePL >= 0 ? '+' : ''}${r.housePL}</td></tr>
    `).join('');

    $('admin-users-tbl').innerHTML = data.users.map(u => `
      <tr><td>${u.username}</td><td>PKR ${Number(u.balance).toLocaleString()}</td><td>${u.wins}</td>
      <td>${u.referred_by ? 'Yes' : '—'}</td>
      <td><button class="btn-ghost" onclick="adminFund('${u.username}')">+Funds</button></td></tr>
    `).join('');
  } catch (e) { toast(e.message); }
}

function adminFund(username) { $('fund-user').value = username; }

async function adminAddFunds() {
  try {
    await API.admin('POST', { username: $('fund-user').value.trim(), amount: parseInt($('fund-amt').value) });
    toast('Funds added!', true);
    $('fund-amt').value = '';
    loadAdmin();
  } catch (e) { toast(e.message); }
}

// ── Init ──
async function init() {
  initBg();
  renderAllDiceFaces(1);

  const params = new URLSearchParams(location.search);
  const ref = params.get('ref');
  if (ref) {
    showAuth('register');
    $('reg-referral').value = ref;
  }

  if (API.token) {
    try {
      const data = await API.me();
      API.setToken(API.token);
      await enterApp(data.user);
      renderHistory(data.history);
      renderReferrals(data.referrals);
      return;
    } catch (_) {
      API.setToken(null);
    }
  }

  $('app-loader').classList.add('hidden');
  showAuth('login');

  if (typeof gsap !== 'undefined') {
    gsap.from('.auth-icon', { rotationY: 360, duration: 1, ease: 'power2.out', delay: 0.2 });
  }
}

document.addEventListener('DOMContentLoaded', init);

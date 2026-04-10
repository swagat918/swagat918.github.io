'use strict';

/* ═══════════════════════════════════════════════════════════════════════════════
   GameZone – app.js
   Contains: Theme, Navigation, Toast, Confetti, Storage helpers,
             and 5 games: Number Guessing · Rock Paper Scissors · Tic-Tac-Toe
                          Memory Match · Simon Says
   ═══════════════════════════════════════════════════════════════════════════════ */

// ─── Theme ────────────────────────────────────────────────────────────────────
const THEME_KEY = 'gz-theme';

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  // Default: dark
  const isDark = saved ? saved === 'dark' : true;
  applyTheme(isDark);
}

function applyTheme(isDark) {
  document.body.classList.toggle('dark', isDark);
  document.body.classList.toggle('light', !isDark);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark');
  applyTheme(!isDark);
  localStorage.setItem(THEME_KEY, !isDark ? 'dark' : 'light');
}

// ─── Navigation ───────────────────────────────────────────────────────────────
let currentView = 'hub';
const viewEls = {};

function initNavigation() {
  document.querySelectorAll('.view').forEach(el => {
    const id = el.id.replace('view-', '');
    viewEls[id] = el;
  });

  // Game card / play-btn clicks
  document.querySelectorAll('[data-game]').forEach(el => {
    el.addEventListener('click', e => {
      const game = el.dataset.game;
      if (game) { e.stopPropagation(); navigateTo(game); }
    });
  });

  // Keyboard: Enter/Space on game card
  document.querySelectorAll('.game-card').forEach(card => {
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateTo(card.dataset.game);
      }
    });
  });

  // Back buttons
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => navigateTo('hub'));
  });

  // Logo / home
  document.getElementById('homeBtn')?.addEventListener('click', () => navigateTo('hub'));

  // Theme toggle
  document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

  // PWA install
  initInstallPrompt();
}

function navigateTo(viewId) {
  const prev = viewEls[currentView];
  if (prev) prev.classList.remove('active');

  const next = viewEls[viewId];
  if (!next) return;
  next.classList.add('active');
  currentView = viewId;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (viewId !== 'hub') onGameEnter(viewId);
}

const gameInited = {};
function onGameEnter(id) {
  if (!gameInited[id]) {
    gameInited[id] = true;
    switch (id) {
      case 'number': initNumberGame();  break;
      case 'rps':    initRPS();         break;
      case 'ttt':    initTTT();         break;
      case 'memory': initMemory();      break;
      case 'simon':  initSimon();       break;
    }
  } else {
    // Game already initialised – reset to a fresh state on each re-entry
    switch (id) {
      case 'number': ngReset();    break;
      case 'ttt':    tttReset();   break;
      case 'memory': memNewGame(); break;
      case 'simon':  simonReset(); break;
      // RPS keeps its running score across visits intentionally
    }
  }
}

// ─── PWA Install Prompt ───────────────────────────────────────────────────────
function initInstallPrompt() {
  let deferredPrompt = null;
  const btn = document.getElementById('installBtn');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (btn) btn.hidden = false;
  });
  btn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') { btn.hidden = true; deferredPrompt = null; }
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function triggerConfetti(containerId) {
  const box = document.getElementById(containerId);
  if (!box) return;
  box.hidden = false;
  box.innerHTML = '';
  const COLORS = ['#6366f1','#a855f7','#ec4899','#22c55e','#f97316','#3b82f6','#eab308','#fff'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText = `
      left:${Math.random() * 100}%;
      width:${6 + Math.random() * 8}px;
      height:${6 + Math.random() * 8}px;
      background:${COLORS[Math.floor(Math.random() * COLORS.length)]};
      animation-duration:${1.4 + Math.random() * 2.2}s;
      animation-delay:${Math.random() * 0.6}s;
      border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    box.appendChild(p);
  }
  setTimeout(() => { box.hidden = true; box.innerHTML = ''; }, 4500);
}

// ─── Storage helpers ─────────────────────────────────────────────────────────
// Only non-sensitive game preferences and scores are persisted here.
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ─── Fisher-Yates shuffle ─────────────────────────────────────────────────────
/** Returns a new array with elements in uniformly random order. */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GAME 1 · NUMBER GUESSING
   ═══════════════════════════════════════════════════════════════════════════════ */

const NG = {
  DIFFS: {
    easy:   { max: 50,  optimal: 6 },
    medium: { max: 100, optimal: 7 },
    hard:   { max: 500, optimal: 9 },
  },
  K: {
    stats:   'gz-ng-stats',
    history: 'gz-ng-history',
    streak:  'gz-ng-streak',
    sound:   'gz-ng-sound',
  },
  state: {
    answer: 0, maxRange: 100, attempts: 0, guesses: [],
    gameOver: false, streak: 0, soundOn: true,
    difficulty: 'medium', audioCtx: null,
  },
};

function initNumberGame() {
  const s = NG.state;
  s.streak  = load(NG.K.streak,  0);
  s.soundOn = load(NG.K.sound,   true);

  const $ = id => document.getElementById(id);
  $('ng-difficulty').addEventListener('change', e => { s.difficulty = e.target.value; ngReset(); });
  $('ng-submitBtn').addEventListener('click', ngCheck);
  $('ng-input').addEventListener('input', () => { $('ng-submitBtn').disabled = !ngCanSubmit(); });
  $('ng-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !$('ng-submitBtn').disabled) ngCheck(); });
  $('ng-resetBtn').addEventListener('click', ngReset);
  $('ng-sound').addEventListener('click', () => {
    s.soundOn = !s.soundOn;
    save(NG.K.sound, s.soundOn);
    $('ng-sound').textContent = s.soundOn ? '🔊 Sound On' : '🔇 Sound Off';
  });
  $('ng-resetStats').addEventListener('click', () => {
    save(NG.K.stats, null);
    save(NG.K.history, []);
    save(NG.K.streak, 0);
    s.streak = 0;
    ngUpdateBadge();
    ngRenderStats();
    ngRenderHistory();
    showToast('Stats cleared!');
  });
  $('ng-sound').textContent = s.soundOn ? '🔊 Sound On' : '🔇 Sound Off';
  ngReset();
}

function ngCanSubmit() {
  const v = parseInt(document.getElementById('ng-input').value, 10);
  return Number.isInteger(v) && v >= 1 && v <= NG.state.maxRange;
}

function ngSecret() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % NG.state.maxRange) + 1;
}

function ngCheck() {
  const s = NG.state;
  if (s.gameOver) return;
  const inp  = document.getElementById('ng-input');
  const fb   = document.getElementById('ng-feedback');
  const hint = document.getElementById('ng-hint');
  const sub  = document.getElementById('ng-submitBtn');

  // Robust integer parse and range check
  const raw   = inp.value.trim();
  const guess = parseInt(raw, 10);

  if (!Number.isInteger(guess) || guess < 1 || guess > s.maxRange) {
    fb.textContent = `⚠️ Please enter a whole number between 1 and ${s.maxRange}.`;
    fb.className   = 'feedback error';
    ngBeep(220, 0.12);
    return;
  }

  s.attempts++;
  s.guesses.push(guess);
  ngUpdateCurrentStats();

  if (guess === s.answer) {
    ngWin();
  } else if (guess < s.answer) {
    fb.textContent = '📉 Too low! Try a higher number.';
    fb.className   = 'feedback too-low';
    hint.textContent = [ngWarmth(guess), ngTrend()].filter(Boolean).join(' · ');
    ngBeep(340, 0.1);
  } else {
    // guess > s.answer
    fb.textContent = '📈 Too high! Try a lower number.';
    fb.className   = 'feedback too-high';
    hint.textContent = [ngWarmth(guess), ngTrend()].filter(Boolean).join(' · ');
    ngBeep(290, 0.1);
  }

  inp.value = '';
  sub.disabled = true;
  inp.focus();
}

function ngWarmth(guess) {
  const frac = Math.abs(guess - NG.state.answer) / NG.state.maxRange;
  if (frac <= 0.05) return '🔥 Very hot!';
  if (frac <= 0.15) return '♨️ Warm…';
  if (frac <= 0.35) return '🌡️ Cool…';
  return '🧊 Cold!';
}

function ngTrend() {
  const g = NG.state.guesses;
  if (g.length < 2) return '';
  const prev = Math.abs(g[g.length - 2] - NG.state.answer);
  const curr = Math.abs(g[g.length - 1] - NG.state.answer);
  if (curr < prev) return 'Getting warmer 🌡️↑';
  if (curr > prev) return 'Getting colder 🌡️↓';
  return '';
}

function ngWin() {
  const s   = NG.state;
  const fb  = document.getElementById('ng-feedback');
  const inp = document.getElementById('ng-input');
  const sub = document.getElementById('ng-submitBtn');

  s.gameOver = true;
  s.streak++;
  save(NG.K.streak, s.streak);
  ngUpdateBadge();

  fb.textContent = `🎉 Correct! The number was ${s.answer}. Solved in ${s.attempts} ${s.attempts === 1 ? 'guess' : 'guesses'}!`;
  fb.className   = 'feedback win';
  document.getElementById('ng-hint').textContent = '';
  sub.disabled = true;
  inp.disabled = true;

  ngSaveStats();
  ngAddHistory();
  ngRenderStats();
  ngRenderHistory();
  ngBeep(523, 0.15);
  triggerConfetti('confetti-box');
  showToast(`🎉 Solved in ${s.attempts} ${s.attempts === 1 ? 'guess' : 'guesses'}!`);
}

function ngUpdateBadge() {
  const s = NG.state.streak;
  const el = document.getElementById('ng-streak');
  if (el) el.textContent = `🔥 ${s} win${s !== 1 ? 's' : ''}`;
}

function ngUpdateCurrentStats() {
  const el = document.getElementById('ng-stats');
  if (!el) return;
  const s    = NG.state;
  const last = s.guesses.slice(-6).join(', ') + (s.guesses.length > 6 ? '…' : '');
  el.innerHTML = `
    🎯 Attempts: <strong>${s.attempts}</strong>
    <em style="color:var(--text-muted);font-size:.8em">(optimal ~${NG.DIFFS[s.difficulty].optimal})</em><br>
    🧾 Guesses: ${last || '–'}<br>
    🔥 Streak: <strong>${s.streak}</strong>`;
}

function ngSaveStats() {
  const stats = load(NG.K.stats, {});
  const d     = NG.state.difficulty;
  if (!stats[d]) stats[d] = {};
  stats[d].games         = (stats[d].games         || 0) + 1;
  stats[d].totalAttempts = (stats[d].totalAttempts || 0) + NG.state.attempts;
  if (!stats[d].bestAttempts || NG.state.attempts < stats[d].bestAttempts)
    stats[d].bestAttempts = NG.state.attempts;
  save(NG.K.stats, stats);
}

function ngRenderStats() {
  const el    = document.getElementById('ng-stats');
  if (!el) return;
  const stats = load(NG.K.stats, {});
  const d     = NG.state.difficulty;
  const s     = stats[d];
  if (!s || !s.games) { el.innerHTML = ''; return; }
  const avg = (s.totalAttempts / s.games).toFixed(1);
  el.innerHTML = `
    📊 <strong>${d.charAt(0).toUpperCase() + d.slice(1)}</strong>:
    ${s.games} game${s.games !== 1 ? 's' : ''} · avg ${avg} guesses · best ${s.bestAttempts}<br>
    🔥 Win streak: <strong>${NG.state.streak}</strong>`;
}

function ngAddHistory() {
  const h = load(NG.K.history, []);
  h.unshift({
    difficulty: NG.state.difficulty,
    attempts:   NG.state.attempts,
    answer:     NG.state.answer,
    date:       new Date().toLocaleDateString(),
  });
  if (h.length > 10) h.pop();
  save(NG.K.history, h);
}

function ngRenderHistory() {
  const listEl = document.getElementById('ng-history');
  if (!listEl) return;
  const h = load(NG.K.history, []);
  if (!h.length) {
    listEl.innerHTML = '<em style="color:var(--text-muted)">No history yet.</em>';
    return;
  }
  listEl.innerHTML = h.map(e => `
    <div class="history-entry">
      <span style="color:var(--accent,var(--primary));font-weight:700">${e.difficulty}</span>
      <span>${e.attempts} guess${e.attempts !== 1 ? 'es' : ''}</span>
      <span>answer: ${e.answer}</span>
      <span style="color:var(--text-muted);font-size:.8em">${e.date}</span>
    </div>`).join('');
}

function ngReset() {
  const s    = NG.state;
  const diff = document.getElementById('ng-difficulty');
  s.difficulty = diff ? diff.value : 'medium';
  s.maxRange   = NG.DIFFS[s.difficulty].max;
  s.answer     = ngSecret();
  s.attempts   = 0;
  s.guesses    = [];
  s.gameOver   = false;

  const inp  = document.getElementById('ng-input');
  const sub  = document.getElementById('ng-submitBtn');
  const fb   = document.getElementById('ng-feedback');
  const hint = document.getElementById('ng-hint');
  const rng  = document.getElementById('ng-rangeHint');

  if (inp)  { inp.value = ''; inp.disabled = false; inp.max = s.maxRange; inp.placeholder = `Guess (1–${s.maxRange})`; }
  if (sub)  sub.disabled = true;
  if (fb)   { fb.textContent = ''; fb.className = 'feedback'; }
  if (hint) hint.textContent = '';
  if (rng)  rng.textContent = `I'm thinking of a number between 1 and ${s.maxRange}.`;

  ngUpdateBadge();
  ngRenderStats();
  ngRenderHistory();
  inp?.focus();
}

function ngBeep(freq, vol) {
  if (!NG.state.soundOn) return;
  try {
    if (!NG.state.audioCtx)
      NG.state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx  = NG.state.audioCtx;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {}
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GAME 2 · ROCK PAPER SCISSORS
   ═══════════════════════════════════════════════════════════════════════════════ */

const RPS = {
  K:      'gz-rps-scores',
  EMOJIS: { rock:'✊', paper:'🖐', scissors:'✌️' },
  LABELS: { rock:'Rock', paper:'Paper', scissors:'Scissors' },
  BEATS:  { rock:'scissors', paper:'rock', scissors:'paper' },
  scores: { wins:0, losses:0, draws:0 },
};

function initRPS() {
  RPS.scores = load(RPS.K, { wins:0, losses:0, draws:0 });
  document.querySelectorAll('.rps-btn').forEach(btn => {
    btn.addEventListener('click', () => rpsPlay(btn.dataset.choice));
  });
  document.getElementById('rps-reset')?.addEventListener('click', rpsResetScore);
  rpsUpdatePill();
}

function rpsPlay(player) {
  const choices = ['rock','paper','scissors'];
  const bot     = choices[Math.floor(Math.random() * 3)];

  const pEl  = document.getElementById('rps-player');
  const bEl  = document.getElementById('rps-bot');
  const rEl  = document.getElementById('rps-result');

  pEl.classList.remove('bounce'); bEl.classList.remove('bounce');
  // Reading offsetWidth forces a DOM reflow so the browser resets the
  // animation before re-adding the class, making it replay from the start.
  void pEl.offsetWidth;
  void bEl.offsetWidth;
  pEl.textContent = RPS.EMOJIS[player];
  bEl.textContent = RPS.EMOJIS[bot];
  pEl.classList.add('bounce');
  bEl.classList.add('bounce');

  let cls, msg;
  if (player === bot) {
    cls = 'draw'; msg = `🤝 Draw! Both chose ${RPS.LABELS[player]}`;
    RPS.scores.draws++;
  } else if (RPS.BEATS[player] === bot) {
    cls = 'win';  msg = `🎉 You win! ${RPS.LABELS[player]} beats ${RPS.LABELS[bot]}`;
    RPS.scores.wins++;
  } else {
    cls = 'lose'; msg = `😞 You lose! ${RPS.LABELS[bot]} beats ${RPS.LABELS[player]}`;
    RPS.scores.losses++;
  }

  rEl.textContent = msg;
  rEl.className   = `rps-result ${cls}`;
  save(RPS.K, RPS.scores);
  rpsUpdatePill();
}

function rpsResetScore() {
  RPS.scores = { wins:0, losses:0, draws:0 };
  save(RPS.K, RPS.scores);
  rpsUpdatePill();
  document.getElementById('rps-player').textContent = '❓';
  document.getElementById('rps-bot').textContent    = '❓';
  const rEl = document.getElementById('rps-result');
  rEl.textContent = ''; rEl.className = 'rps-result';
  showToast('Score reset!');
}

function rpsUpdatePill() {
  const { wins, losses, draws } = RPS.scores;
  const el = document.getElementById('rps-scorePill');
  if (el) el.textContent = `${wins}W / ${losses}L / ${draws}D`;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GAME 3 · TIC-TAC-TOE
   ═══════════════════════════════════════════════════════════════════════════════ */

const TTT = {
  K:    'gz-ttt-scores',
  WINS: [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]],
  state: {
    board: Array(9).fill(null),
    current: 'X',
    over: false,
    mode: 'ai',
    scores: { X:0, O:0, draws:0 },
  },
};

function initTTT() {
  TTT.state.scores = load(TTT.K, { X:0, O:0, draws:0 });

  const boardEl = document.getElementById('ttt-board');
  boardEl.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('button');
    cell.className = 'ttt-cell';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `Cell ${i + 1}`);
    cell.dataset.idx = i;
    cell.addEventListener('click', () => tttClick(i));
    boardEl.appendChild(cell);
  }

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
      btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
      TTT.state.mode = btn.dataset.mode;
      tttReset();
    });
  });

  document.getElementById('ttt-reset')?.addEventListener('click', tttReset);
  tttUpdatePill();
  tttReset();
}

function tttClick(i) {
  const s = TTT.state;
  if (s.over || s.board[i]) return;
  if (s.mode === 'ai' && s.current === 'O') return;
  tttMove(i, s.current);
  if (!s.over && s.mode === 'ai' && s.current === 'O')
    setTimeout(tttAI, 360);
}

function tttMove(i, player) {
  const s = TTT.state;
  s.board[i] = player;
  tttRender();
  const result = tttResult(s.board);
  if (result) {
    tttEnd(result);
  } else {
    s.current = s.current === 'X' ? 'O' : 'X';
    tttStatus();
  }
}

function tttAI() {
  const idx = tttBest();
  if (idx !== -1) tttMove(idx, 'O');
}

function tttBest() {
  const b = TTT.state.board;
  let bestScore = -Infinity, bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (!b[i]) {
      b[i] = 'O';
      const score = tttMinimax(b, 0, false);
      b[i] = null;
      if (score > bestScore) { bestScore = score; bestMove = i; }
    }
  }
  return bestMove;
}

function tttMinimax(board, depth, maximising) {
  const r = tttResult(board);
  if (r === 'O') return 10 - depth;
  if (r === 'X') return depth - 10;
  if (r === 'draw') return 0;
  if (maximising) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) { board[i] = 'O'; best = Math.max(best, tttMinimax(board, depth+1, false)); board[i] = null; }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (!board[i]) { board[i] = 'X'; best = Math.min(best, tttMinimax(board, depth+1, true)); board[i] = null; }
    }
    return best;
  }
}

function tttResult(board) {
  for (const [a,b,c] of TTT.WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  if (board.every(c => c)) return 'draw';
  return null;
}

function tttWinLine(board) {
  for (const line of TTT.WINS) {
    const [a,b,c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

function tttEnd(result) {
  const s  = TTT.state;
  s.over   = true;
  const stEl = document.getElementById('ttt-status');

  if (result === 'draw') {
    stEl.textContent = "🤝 It's a draw!";
    s.scores.draws++;
    showToast("🤝 Draw!");
  } else {
    s.scores[result]++;
    let label;
    if (s.mode === '2p') {
      label = result === 'X' ? '🎉 Player X wins!' : '🎉 Player O wins!';
    } else {
      label = result === 'X' ? '🎉 You win!' : '🤖 AI wins!';
    }
    stEl.textContent = label;

    // Highlight winning cells
    const line = tttWinLine(s.board);
    if (line) {
      const cells = document.querySelectorAll('.ttt-cell');
      line.forEach(i => cells[i]?.classList.add('winning'));
    }
    if (result === 'X' || (s.mode === '2p' && result === 'O'))
      triggerConfetti('confetti-box');
    showToast(label);
  }

  save(TTT.K, s.scores);
  tttUpdatePill();
  document.querySelectorAll('.ttt-cell').forEach(c => c.classList.add('taken'));
}

function tttStatus() {
  const s  = TTT.state;
  const el = document.getElementById('ttt-status');
  if (!el) return;
  if (s.mode === 'ai')
    el.textContent = s.current === 'X' ? 'Your turn (X)' : 'AI is thinking…';
  else
    el.textContent = `Player ${s.current}'s turn`;
}

function tttUpdatePill() {
  const el = document.getElementById('ttt-scorePill');
  const { X, O, draws } = TTT.state.scores;
  if (el) el.textContent = `X: ${X} – O: ${O} – D: ${draws}`;
}

function tttRender() {
  const cells = document.querySelectorAll('.ttt-cell');
  cells.forEach((cell, i) => {
    const v = TTT.state.board[i];
    cell.textContent = v || '';
    cell.className   = `ttt-cell${v ? ` ${v.toLowerCase()} taken` : ''}`;
    cell.setAttribute('aria-label', `Cell ${i+1}${v ? ': ' + v : ''}`);
  });
}

function tttReset() {
  const s    = TTT.state;
  s.board    = Array(9).fill(null);
  s.current  = 'X';
  s.over     = false;
  tttRender();
  tttStatus();
  tttUpdatePill();
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GAME 4 · MEMORY MATCH
   ═══════════════════════════════════════════════════════════════════════════════ */

const MEM = {
  K:      'gz-mem-best',
  EMOJIS: ['🍕','🎸','🚀','🦊','🎯','🌈','⚡','🎲','🦁','🌺','🎪','🍦','🦋','🎨'],
  state: {
    cards: [], flipped: [], matched: 0,
    moves: 0, timer: null, seconds: 0,
    best: null, locked: false, started: false,
  },
};

function initMemory() {
  MEM.state.best = load(MEM.K, null);
  memUpdateBest();
  document.getElementById('mem-reset')?.addEventListener('click', memNewGame);
  memNewGame();
}

function memNewGame() {
  const s = MEM.state;
  clearInterval(s.timer);
  Object.assign(s, { flipped:[], matched:0, moves:0, seconds:0, locked:false, started:false });

  const pairs  = 8;
  const chosen = shuffle(MEM.EMOJIS).slice(0, pairs);
  s.cards      = shuffle([...chosen, ...chosen]);

  memRender();
  memBar();
  document.getElementById('mem-time').textContent = '0s';
}

function memRender() {
  const board = document.getElementById('mem-board');
  board.innerHTML = '';
  MEM.state.cards.forEach((emoji, i) => {
    const card = document.createElement('div');
    card.className = 'mem-card';
    card.setAttribute('role', 'gridcell');
    card.setAttribute('aria-label', `Card ${i+1}`);
    card.dataset.idx = i;
    card.innerHTML = `
      <div class="mem-card-inner">
        <div class="mem-card-front" aria-hidden="true">?</div>
        <div class="mem-card-back"  aria-hidden="true">${emoji}</div>
      </div>`;
    card.addEventListener('click', () => memFlip(i));
    board.appendChild(card);
  });
}

function memFlip(idx) {
  const s = MEM.state;
  if (s.locked) return;
  const cards = document.querySelectorAll('.mem-card');
  const card  = cards[idx];
  if (!card || card.classList.contains('matched') || s.flipped.includes(idx)) return;

  // Start timer on first flip
  if (!s.started) {
    s.started = true;
    s.timer   = setInterval(() => {
      s.seconds++;
      document.getElementById('mem-time').textContent = `${s.seconds}s`;
    }, 1000);
  }

  card.classList.add('flipped');
  s.flipped.push(idx);

  if (s.flipped.length === 2) {
    s.moves++;
    memBar();
    s.locked = true;
    const [a, b] = s.flipped;
    if (s.cards[a] === s.cards[b]) {
      setTimeout(() => {
        cards[a].classList.add('matched');
        cards[b].classList.add('matched');
        s.matched++;
        s.flipped = [];
        s.locked  = false;
        memBar();
        if (s.matched === s.cards.length / 2) memWin();
      }, 320);
    } else {
      setTimeout(() => {
        cards[a].classList.remove('flipped');
        cards[b].classList.remove('flipped');
        s.flipped = [];
        s.locked  = false;
      }, 950);
    }
  }
}

function memWin() {
  const s = MEM.state;
  clearInterval(s.timer);
  if (s.best === null || s.moves < s.best) {
    s.best = s.moves;
    save(MEM.K, s.best);
    memUpdateBest();
    showToast(`🏆 New best: ${s.moves} moves in ${s.seconds}s!`);
  } else {
    showToast(`🎉 Solved in ${s.moves} moves!`);
  }
  triggerConfetti('confetti-box');
}

function memBar() {
  const s = MEM.state;
  document.getElementById('mem-pairs').textContent = `${s.matched}/${s.cards.length / 2}`;
  document.getElementById('mem-moves').textContent = s.moves;
}

function memUpdateBest() {
  const el = document.getElementById('mem-best');
  if (el) el.textContent = MEM.state.best !== null ? `Best: ${MEM.state.best} moves` : 'Best: –';
}

/* ═══════════════════════════════════════════════════════════════════════════════
   GAME 5 · SIMON SAYS
   ═══════════════════════════════════════════════════════════════════════════════ */

const SIMON = {
  K:      'gz-simon-best',
  COLORS: ['#ef4444','#3b82f6','#22c55e','#eab308'],
  BEEPS:  [261.63, 329.63, 392.00, 523.25], // C4 E4 G4 C5
  state: {
    sequence: [],
    player:   [],
    level:    0,
    playing:  false,
    canInput: false,
    best:     0,
    audioCtx: null,
  },
};

function initSimon() {
  SIMON.state.best = load(SIMON.K, 0);
  simonUpdateBest();

  document.querySelectorAll('.simon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!SIMON.state.canInput) return;
      const idx = parseInt(btn.dataset.idx, 10);
      simonFlash(idx, true);
      simonPlayerInput(idx);
    });
  });

  document.getElementById('simon-start')?.addEventListener('click', simonStart);

  // Ensure buttons start disabled until game starts
  document.querySelectorAll('.simon-btn').forEach(b => b.disabled = true);
}

function simonStart() {
  const s = SIMON.state;
  s.sequence = [];
  s.player   = [];
  s.level    = 0;
  s.canInput = false;
  document.getElementById('simon-start').disabled = true;
  document.querySelectorAll('.simon-btn').forEach(b => b.disabled = false);
  simonNextRound();
}

function simonNextRound() {
  const s = SIMON.state;
  s.player  = [];
  s.canInput = false;
  s.sequence.push(Math.floor(Math.random() * 4));
  s.level = s.sequence.length;
  document.getElementById('simon-level').textContent = s.level;
  document.getElementById('simon-status').textContent = 'Watch the pattern…';
  simonPlaySequence(() => {
    s.canInput = true;
    document.getElementById('simon-status').textContent = 'Your turn! Repeat the pattern.';
  });
}

function simonPlaySequence(onDone) {
  const seq   = SIMON.state.sequence;
  let   i     = 0;
  const delay = Math.max(300, 800 - seq.length * 30);

  function next() {
    if (i >= seq.length) { setTimeout(onDone, 400); return; }
    simonFlash(seq[i], false);
    i++;
    setTimeout(next, delay + 200);
  }
  setTimeout(next, 400);
}

function simonFlash(idx, isPlayer) {
  const btn  = document.getElementById(`simon-${idx}`);
  const dur  = isPlayer ? 180 : 420;
  if (!btn) return;
  btn.classList.add('active');
  simonBeep(idx);
  setTimeout(() => btn.classList.remove('active'), dur);
}

function simonPlayerInput(idx) {
  const s = SIMON.state;
  s.player.push(idx);
  const pos = s.player.length - 1;

  if (s.player[pos] !== s.sequence[pos]) {
    // Wrong!
    simonFail();
    return;
  }

  if (s.player.length === s.sequence.length) {
    // Round complete
    s.canInput = false;
    if (s.level > s.best) {
      s.best = s.level;
      save(SIMON.K, s.best);
      simonUpdateBest();
    }
    document.getElementById('simon-status').textContent = '✅ Correct! Get ready…';
    setTimeout(simonNextRound, 1100);
  }
}

function simonFail() {
  const s = SIMON.state;
  s.canInput = false;
  document.getElementById('simon-status').textContent = `❌ Wrong! You reached level ${s.level}.`;
  document.getElementById('simon-start').disabled = false;
  document.querySelectorAll('.simon-btn').forEach(b => b.disabled = true);
  showToast(`Game over! You reached level ${s.level}`);
  // Flash all red briefly
  document.querySelectorAll('.simon-btn').forEach(b => b.classList.add('active'));
  setTimeout(() => document.querySelectorAll('.simon-btn').forEach(b => b.classList.remove('active')), 500);
}

function simonReset() {
  const s = SIMON.state;
  s.sequence = [];
  s.player   = [];
  s.level    = 0;
  s.canInput = false;
  document.getElementById('simon-level').textContent  = 0;
  document.getElementById('simon-status').textContent = 'Press Start to play!';
  document.getElementById('simon-start').disabled     = false;
  document.querySelectorAll('.simon-btn').forEach(b => { b.disabled = true; b.classList.remove('active'); });
}

function simonUpdateBest() {
  const el = document.getElementById('simon-best');
  if (el) el.textContent = `Best: ${SIMON.state.best}`;
}

function simonBeep(idx) {
  try {
    if (!SIMON.state.audioCtx)
      SIMON.state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx  = SIMON.state.audioCtx;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = 'sine';
    osc.frequency.value = SIMON.BEEPS[idx];
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {}
}

/* ═══════════════════════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
});

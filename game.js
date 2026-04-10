/**
 * Number Guessing Game – game.js
 * Modular game logic covering: Web Audio API sounds, per-difficulty stats,
 * smart hints, streak counter, game history, confetti, keyboard shortcuts,
 * PWA install prompt, and localStorage error handling.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Difficulty configurations keyed by select value. */
const DIFFICULTIES = {
  easy:   { label: 'Easy',   max: 50,  optimalMoves: 6 },
  medium: { label: 'Medium', max: 100, optimalMoves: 7 },
  hard:   { label: 'Hard',   max: 500, optimalMoves: 9 },
};

/** Maximum number of recent guesses to show inline. */
const MAX_DISPLAYED_GUESSES = 5;

/** Maximum number of history entries to persist. */
const MAX_HISTORY_ENTRIES = 10;

/** Distance fraction of range below which a guess is considered "hot". */
const HOT_THRESHOLD_PCT = 0.05;

/** Distance fraction of range below which a guess is considered "warm". */
const WARM_THRESHOLD_PCT = 0.15;

/** localStorage key names. */
const STORAGE_KEYS = {
  stats:      'gg_stats',
  history:    'gg_history',
  streak:     'gg_streak',
  darkMode:   'gg_dark',
  soundMuted: 'gg_muted',
};

// ─── DOM References ───────────────────────────────────────────────────────────

const difficultyEl   = document.getElementById('difficulty');
const inputEl        = document.getElementById('guessInput');
const feedbackEl     = document.getElementById('feedback');
const hintMessageEl  = document.getElementById('hintMessage');
const resetBtn       = document.getElementById('resetBtn');
const submitBtn      = document.getElementById('submitBtn');
const rangeHintEl    = document.getElementById('rangeHint');
const currentStatsEl = document.getElementById('currentStats');
const statsPanelEl   = document.getElementById('statsPanel');
const gameHistoryEl  = document.getElementById('gameHistory');
const winCelebration = document.getElementById('winCelebration');
const resetStatsBtn  = document.getElementById('resetStatsBtn');
const toggleDarkBtn  = document.getElementById('toggleDarkBtn');
const toggleSoundBtn = document.getElementById('toggleSoundBtn');
const installBtn     = document.getElementById('installBtn');

// ─── Game State ───────────────────────────────────────────────────────────────

let currentDifficulty = 'medium';
let maxRange          = DIFFICULTIES[currentDifficulty].max;
let secretNumber      = generateSecret();
let attempts          = 0;
let guesses           = [];
let gameOver          = false;
let streak            = loadPref(STORAGE_KEYS.streak, 0);

// ─── Audio (Web Audio API – no CORS issues) ───────────────────────────────────

/** Lazily-created AudioContext shared across all sounds. */
let audioCtx = null;

/** Whether sound is currently muted. */
let soundMuted = loadPref(STORAGE_KEYS.soundMuted, false);

/**
 * Returns (or creates) the shared AudioContext.
 * @returns {AudioContext}
 */
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Plays a synthesised tone.
 * @param {number} frequency     - Hz
 * @param {number} duration      - seconds
 * @param {'sine'|'square'|'triangle'|'sawtooth'} [type='sine'] - waveform
 * @param {number} [volume=0.3]  - gain 0–1
 */
function playTone(frequency, duration, type = 'sine', volume = 0.3) {
  if (soundMuted) return;
  try {
    const ctx  = getAudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type            = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (_) {
    // Audio API unavailable; silently ignore.
  }
}

/** Plays a pleasant ascending win chord. */
function playWinSound() {
  playTone(523,  0.15);
  setTimeout(() => playTone(659, 0.15), 150);
  setTimeout(() => playTone(784, 0.30), 300);
  setTimeout(() => playTone(1047, 0.4), 450);
}

/** Plays a short buzzer for wrong/error feedback. */
function playWrongSound() {
  playTone(220, 0.15, 'sawtooth', 0.2);
}

/** Plays a subtle click for UI interaction confirmation. */
function playClickSound() {
  playTone(660, 0.05, 'sine', 0.1);
}

// ─── Storage Helpers ──────────────────────────────────────────────────────────

/**
 * Safely reads a JSON value from localStorage.
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
function loadPref(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch (_) {
    return defaultValue;
  }
}

/**
 * Safely writes a JSON value to localStorage.
 * Handles QuotaExceededError gracefully.
 * @param {string} key
 * @param {*} value
 */
function savePref(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded; data not persisted.');
    }
  }
}

/**
 * Returns the persisted per-difficulty statistics object.
 * @returns {{ easy: object, medium: object, hard: object }}
 */
function loadStats() {
  const defaults = {
    easy:   { gamesPlayed: 0, totalAttempts: 0, bestScore: null },
    medium: { gamesPlayed: 0, totalAttempts: 0, bestScore: null },
    hard:   { gamesPlayed: 0, totalAttempts: 0, bestScore: null },
  };
  const stored = loadPref(STORAGE_KEYS.stats, defaults);
  // Ensure all difficulty keys exist (in case new keys were added after first save).
  return Object.assign(defaults, stored);
}

/** @param {{ easy: object, medium: object, hard: object }} stats */
function saveStats(stats) {
  savePref(STORAGE_KEYS.stats, stats);
}

/**
 * Returns the persisted game history array.
 * @returns {Array<{difficulty:string, attempts:number, answer:number, date:string}>}
 */
function loadHistory() {
  return loadPref(STORAGE_KEYS.history, []);
}

/** @param {Array} history */
function saveHistory(history) {
  savePref(STORAGE_KEYS.history, history);
}

// ─── Game Logic ───────────────────────────────────────────────────────────────

/**
 * Generates a new secret number within the current range using the
 * Web Crypto API for unbiased randomness.
 * @returns {number}
 */
function generateSecret() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % maxRange) + 1;
}

/**
 * Returns a proximity label based on how close a guess is to the secret number.
 * @param {number} guess
 * @returns {string}
 */
function getWarmthHint(guess) {
  const distance = Math.abs(guess - secretNumber);
  const fraction = distance / maxRange;
  if (fraction <= HOT_THRESHOLD_PCT)  return '🔥 Very hot!';
  if (fraction <= WARM_THRESHOLD_PCT) return '♨️ Warm…';
  if (fraction <= 0.35)               return '🌡️ Cool…';
  return '🧊 Cold!';
}

/**
 * Returns a warmer/colder trend message by comparing the last two guesses.
 * @returns {string}
 */
function getTrendHint() {
  if (guesses.length < 2) return '';
  const prev = Math.abs(guesses[guesses.length - 2] - secretNumber);
  const curr = Math.abs(guesses[guesses.length - 1] - secretNumber);
  if (curr < prev) return 'Getting warmer! 🌡️↑';
  if (curr > prev) return 'Getting colder! 🌡️↓';
  return '';
}

/**
 * Validates whether a parsed guess value is within the acceptable range.
 * @param {number} guess
 * @returns {boolean}
 */
function isValidGuess(guess) {
  return Number.isInteger(guess) && guess >= 1 && guess <= maxRange;
}

/**
 * Checks whether the current input value can be submitted.
 * @returns {boolean}
 */
function canSubmitGuess() {
  const val = inputEl.valueAsNumber;
  return !Number.isNaN(val) && val >= 1 && val <= maxRange;
}

/**
 * Main guess-checking logic. Validates input, updates state, and renders results.
 */
function checkGuess() {
  if (gameOver) return;

  const guess = parseInt(inputEl.value, 10);

  if (!isValidGuess(guess)) {
    feedbackEl.textContent = `⚠️ Please enter a number between 1 and ${maxRange}.`;
    feedbackEl.className   = 'feedback error';
    playWrongSound();
    return;
  }

  attempts++;
  guesses.push(guess);
  updateCurrentStats();

  if (guess < secretNumber) {
    feedbackEl.textContent    = '📉 Too low! Try a higher number.';
    feedbackEl.className      = 'feedback too-low';
    hintMessageEl.textContent = [getWarmthHint(guess), getTrendHint()].filter(Boolean).join(' ');
    playWrongSound();
  } else if (guess > secretNumber) {
    feedbackEl.textContent    = '📈 Too high! Try a lower number.';
    feedbackEl.className      = 'feedback too-high';
    hintMessageEl.textContent = [getWarmthHint(guess), getTrendHint()].filter(Boolean).join(' ');
    playWrongSound();
  } else {
    handleWin();
  }

  inputEl.value      = '';
  submitBtn.disabled = true;
  inputEl.focus();
}

/**
 * Handles all win-state updates: stats, streak, history, sounds, and celebration.
 */
function handleWin() {
  const optimal = DIFFICULTIES[currentDifficulty].optimalMoves;
  let praise = '';
  if (attempts <= optimal)           praise = ' 🌟 Optimal solve!';
  else if (attempts <= optimal * 2)  praise = ' 👍 Great job!';

  feedbackEl.textContent    = `🎉 Correct! You guessed ${secretNumber} in ${attempts} ${attempts === 1 ? 'try' : 'tries'}.${praise}`;
  feedbackEl.className      = 'feedback win';
  hintMessageEl.textContent = '';
  gameOver                  = true;
  inputEl.disabled          = true;
  submitBtn.disabled        = true;
  resetBtn.classList.add('visible');

  // Update per-difficulty stats.
  const allStats = loadStats();
  const ds       = allStats[currentDifficulty];
  ds.gamesPlayed++;
  ds.totalAttempts += attempts;
  if (ds.bestScore === null || attempts < ds.bestScore) ds.bestScore = attempts;
  saveStats(allStats);

  // Update win streak.
  streak++;
  savePref(STORAGE_KEYS.streak, streak);

  // Record game history.
  addHistoryEntry();

  // Sound and visual celebration.
  playWinSound();
  triggerCelebration();

  // Refresh stat panels.
  updateStatsPanel();
  updateCurrentStats();

  // Suggest a harder difficulty after consecutive wins.
  checkProgressionSuggestion();
}

/**
 * Prepends a new entry to the game history and persists it.
 */
function addHistoryEntry() {
  const history = loadHistory();
  history.unshift({
    difficulty: DIFFICULTIES[currentDifficulty].label,
    attempts,
    answer: secretNumber,
    date: new Date().toLocaleString('en', { dateStyle: 'short', timeStyle: 'short' }),
  });
  if (history.length > MAX_HISTORY_ENTRIES) history.pop();
  saveHistory(history);
  renderHistory();
}

/**
 * Spawns CSS-animated confetti pieces for the win celebration.
 */
function triggerCelebration() {
  winCelebration.hidden = false;
  winCelebration.removeAttribute('aria-hidden');
  winCelebration.innerHTML = '';

  const colors = ['#0078d4', '#ff6b6b', '#51cf66', '#ffd43b', '#cc5de8', '#74c0fc'];

  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = [
      `left: ${Math.random() * 100}%`,
      `background: ${colors[Math.floor(Math.random() * colors.length)]}`,
      `animation-delay: ${(Math.random() * 0.5).toFixed(2)}s`,
      `animation-duration: ${(0.8 + Math.random() * 0.8).toFixed(2)}s`,
      `width: ${Math.round(6 + Math.random() * 8)}px`,
      `height: ${Math.round(6 + Math.random() * 8)}px`,
      `border-radius: ${Math.random() > 0.5 ? '50%' : '2px'}`,
    ].join(';');
    winCelebration.appendChild(piece);
  }

  setTimeout(() => {
    winCelebration.hidden = true;
    winCelebration.setAttribute('aria-hidden', 'true');
  }, 2000);
}

/**
 * Shows a toast suggesting a harder difficulty after 3+ consecutive wins.
 */
function checkProgressionSuggestion() {
  if (streak >= 3 && currentDifficulty === 'easy') {
    showToast("🚀 You're on a streak! Try Medium mode!");
  } else if (streak >= 3 && currentDifficulty === 'medium') {
    showToast('🔥 Hot streak! Ready for Hard mode?');
  }
}

/**
 * Displays a temporary toast notification.
 * @param {string} message
 */
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3500);
}

// ─── UI Rendering ─────────────────────────────────────────────────────────────

/**
 * Synchronises the range hint text and input attributes with the current difficulty.
 */
function updateRangeHint() {
  rangeHintEl.textContent = `I'm thinking of a number between 1 and ${maxRange}.`;
  inputEl.max             = maxRange;
  inputEl.placeholder     = `Guess (1–${maxRange})`;
  inputEl.setAttribute('aria-label', `Enter a number between 1 and ${maxRange}`);
}

/**
 * Refreshes the current-game statistics display.
 */
function updateCurrentStats() {
  const guessText = formatGuessHistory();
  const optimal   = DIFFICULTIES[currentDifficulty].optimalMoves;
  const effText   = attempts > 0 ? ` <em>(optimal: ~${optimal})</em>` : '';

  currentStatsEl.innerHTML =
    `🎯 Attempts this round: <strong>${attempts}</strong>${effText}<br>` +
    `🧾 Guesses: ${guessText}<br>` +
    `🔥 Win streak: <strong>${streak}</strong>`;
}

/**
 * Formats the guess history for inline display, truncating older entries.
 * @returns {string}
 */
function formatGuessHistory() {
  if (!guesses.length) return '<em>None yet</em>';
  if (guesses.length <= MAX_DISPLAYED_GUESSES) return guesses.join(', ');
  const recent       = guesses.slice(-MAX_DISPLAYED_GUESSES).join(', ');
  const earlierCount = guesses.length - MAX_DISPLAYED_GUESSES;
  return `${recent} <em>(+${earlierCount} earlier)</em>`;
}

/**
 * Renders the per-difficulty statistics panel.
 */
function updateStatsPanel() {
  const allStats = loadStats();
  statsPanelEl.innerHTML = Object.keys(DIFFICULTIES).map(key => {
    const d    = DIFFICULTIES[key];
    const s    = allStats[key];
    const avg  = s.gamesPlayed ? (s.totalAttempts / s.gamesPlayed).toFixed(1) : '—';
    const best = s.bestScore ?? '—';
    return (
      `<div class="stats-row" aria-label="${d.label} stats">` +
        `<span class="stats-label">${d.label}</span>` +
        `<span>Played: <strong>${s.gamesPlayed}</strong></span>` +
        `<span>Avg: <strong>${avg}</strong></span>` +
        `<span>Best: <strong>${best}</strong></span>` +
      `</div>`
    );
  }).join('');
}

/**
 * Renders the game history list.
 */
function renderHistory() {
  const history = loadHistory();
  if (!history.length) {
    gameHistoryEl.innerHTML = '<em>No games recorded yet.</em>';
    return;
  }
  gameHistoryEl.innerHTML = history.map(entry =>
    `<div class="history-entry">` +
      `<span class="history-diff">${entry.difficulty}</span>` +
      `<span>${entry.attempts} ${entry.attempts === 1 ? 'try' : 'tries'} (answer: ${entry.answer})</span>` +
      `<span class="history-date">${entry.date}</span>` +
    `</div>`
  ).join('');
}

// ─── Game Controls ────────────────────────────────────────────────────────────

/**
 * Handles a difficulty selector change. Confirms with the user if a game is
 * already in progress, then resets.
 */
function setDifficulty() {
  const newDifficulty = difficultyEl.value;
  if (newDifficulty === currentDifficulty) return;

  if (!gameOver && attempts > 0) {
    if (!confirm('Changing difficulty will reset the current game. Continue?')) {
      difficultyEl.value = currentDifficulty; // Revert selector.
      return;
    }
  }

  currentDifficulty = newDifficulty;
  maxRange          = DIFFICULTIES[currentDifficulty].max;
  resetGame();
}

/**
 * Resets the game to a clean initial state with a new secret number.
 */
function resetGame() {
  secretNumber          = generateSecret();
  attempts              = 0;
  guesses               = [];
  gameOver              = false;
  inputEl.value         = '';
  inputEl.disabled      = false;
  submitBtn.disabled    = true;
  feedbackEl.textContent    = '';
  feedbackEl.className      = 'feedback';
  hintMessageEl.textContent = '';
  resetBtn.classList.remove('visible');
  updateRangeHint();
  updateCurrentStats();
  inputEl.focus();
}

/**
 * Toggles dark mode and persists the preference.
 */
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  savePref(STORAGE_KEYS.darkMode, isDark);
  toggleDarkBtn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
  toggleDarkBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

/**
 * Toggles sound and persists the preference.
 */
function toggleSound() {
  soundMuted = !soundMuted;
  savePref(STORAGE_KEYS.soundMuted, soundMuted);
  toggleSoundBtn.textContent = soundMuted ? '🔇 Sound Off' : '🔊 Sound On';
  toggleSoundBtn.setAttribute('aria-label', soundMuted ? 'Enable sound' : 'Disable sound');
  if (!soundMuted) playClickSound();
}

/**
 * Resets all statistics and history after user confirmation.
 */
function resetAllStats() {
  if (!confirm('Reset all statistics? This cannot be undone.')) return;
  saveStats({
    easy:   { gamesPlayed: 0, totalAttempts: 0, bestScore: null },
    medium: { gamesPlayed: 0, totalAttempts: 0, bestScore: null },
    hard:   { gamesPlayed: 0, totalAttempts: 0, bestScore: null },
  });
  streak = 0;
  savePref(STORAGE_KEYS.streak, 0);
  saveHistory([]);
  updateStatsPanel();
  updateCurrentStats();
  renderHistory();
  showToast('📊 Statistics reset!');
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

difficultyEl.addEventListener('change', setDifficulty);
submitBtn.addEventListener('click', checkGuess);
resetBtn.addEventListener('click', resetGame);
toggleDarkBtn.addEventListener('click', toggleDarkMode);
toggleSoundBtn.addEventListener('click', toggleSound);
resetStatsBtn.addEventListener('click', resetAllStats);

inputEl.addEventListener('input', () => {
  submitBtn.disabled = !canSubmitGuess();
});

inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && canSubmitGuess()) {
    submitBtn.classList.add('press-feedback');
    setTimeout(() => submitBtn.classList.remove('press-feedback'), 150);
    checkGuess();
  }
});

// Global keyboard shortcuts (only active when the input is not focused).
document.addEventListener('keydown', e => {
  if (document.activeElement === inputEl) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  switch (e.key.toLowerCase()) {
    case 'r': resetGame();          break;
    case 'd': difficultyEl.focus(); break;
  }
});

// ─── PWA Install Prompt ───────────────────────────────────────────────────────

let deferredInstall = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall    = e;
  installBtn.hidden  = false;
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  if (outcome === 'accepted') installBtn.hidden = true;
  deferredInstall = null;
});

// ─── Service Worker ───────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').catch(err => {
    console.warn('Service worker registration failed:', err);
  });
}

// ─── Initialisation ───────────────────────────────────────────────────────────

(function init() {
  // Restore dark mode preference.
  if (loadPref(STORAGE_KEYS.darkMode, false)) {
    document.body.classList.add('dark');
    toggleDarkBtn.textContent = '☀️ Light Mode';
    toggleDarkBtn.setAttribute('aria-label', 'Switch to light mode');
  }

  // Restore sound preference label.
  toggleSoundBtn.textContent = soundMuted ? '🔇 Sound Off' : '🔊 Sound On';
  toggleSoundBtn.setAttribute('aria-label', soundMuted ? 'Enable sound' : 'Disable sound');

  updateRangeHint();
  updateCurrentStats();
  updateStatsPanel();
  renderHistory();
  inputEl.focus();
}());

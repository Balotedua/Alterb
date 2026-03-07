// core/store.js — Gestione stato persistente (localStorage)

// --- Preferenze utente ---
var PREFS_KEY = 'alter_prefs';

window.loadPrefs = function () {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (e) { return {}; }
};

window.savePref = function (key, value) {
  var prefs = window.loadPrefs();
  prefs[key] = value;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
};

// --- Badge guadagnati ---
var EARNED_KEY = 'alter_badges';

window.getEarned = function () {
  try { return new Set(JSON.parse(localStorage.getItem(EARNED_KEY) || '[]')); } catch (e) { return new Set(); }
};

window.saveEarned = function (set) {
  localStorage.setItem(EARNED_KEY, JSON.stringify(Array.from(set)));
};

window.awardBadge = function (id) {
  var earned = window.getEarned();
  if (earned.has(id)) return false;
  earned.add(id);
  window.saveEarned(earned);
  if (typeof BADGES !== 'undefined' && typeof XP_TABLE !== 'undefined') {
    var b = BADGES.find(function (x) { return x.id === id; });
    if (b) window.showToast('Badge sbloccato: ' + b.title + ' +' + XP_TABLE[b.rarity] + ' XP');
  }
  return true;
};

// --- Streak di accesso ---
window.getStreak = function () {
  return parseInt(localStorage.getItem('alter_streak') || '0', 10);
};

window.updateStreak = function () {
  var today = new Date().toDateString();
  var last = localStorage.getItem('alter_streak_date');
  if (last === today) return window.getStreak();
  var streak = window.getStreak();
  var yesterday = new Date(Date.now() - 86400000).toDateString();
  streak = (last === yesterday) ? streak + 1 : 1;
  localStorage.setItem('alter_streak', streak);
  localStorage.setItem('alter_streak_date', today);
  return streak;
};

// --- Tracking sezioni visitate ---
window.markVisit = function (section) {
  try {
    var visits = JSON.parse(localStorage.getItem('alter_visits') || '{}');
    visits[section] = true;
    localStorage.setItem('alter_visits', JSON.stringify(visits));
  } catch (e) {}
};

window.getVisits = function () {
  try { return JSON.parse(localStorage.getItem('alter_visits') || '{}'); } catch (e) { return {}; }
};

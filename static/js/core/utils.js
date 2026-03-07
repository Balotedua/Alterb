// core/utils.js — Utility condivise tra tutti i moduli

// --- Toast globale ---
(function () {
  var _toastEl = null;
  var _toastTimer = null;

  function _ensureToast() {
    if (_toastEl && document.body.contains(_toastEl)) return _toastEl;
    _toastEl = document.createElement('div');
    _toastEl.id = '_alter_toast';
    _toastEl.style.cssText = [
      'position:fixed', 'bottom:28px', 'left:50%',
      'transform:translateX(-50%) translateY(14px)',
      'background:rgba(18,16,14,0.94)', 'backdrop-filter:blur(16px)',
      'border:1px solid var(--border)', 'border-radius:10px',
      'padding:10px 20px', 'font-size:13px', 'font-weight:500',
      'font-family:Inter,sans-serif', 'color:var(--text)',
      'opacity:0', 'transition:all 0.22s ease',
      'pointer-events:none', 'z-index:9999', 'white-space:nowrap',
    ].join(';');
    document.body.appendChild(_toastEl);
    return _toastEl;
  }

  window.showToast = function (msg, type) {
    var t = _ensureToast();
    t.textContent = msg;
    t.style.borderColor = type === 'error' ? 'rgba(196,100,100,0.3)' : '';
    clearTimeout(_toastTimer);
    // force reflow per riattivare la transizione
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(14px)';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        t.style.opacity = '1';
        t.style.transform = 'translateX(-50%) translateY(0)';
        _toastTimer = setTimeout(function () {
          t.style.opacity = '0';
          t.style.transform = 'translateX(-50%) translateY(14px)';
        }, type === 'error' ? 3000 : 2400);
      });
    });
  };
})();

// --- Date helpers ---
window.formatDate = function (dateStr, format) {
  var d = new Date(dateStr);
  if (format === 'short') {
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }
  if (format === 'relative') {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var dt = new Date(d); dt.setHours(0, 0, 0, 0);
    var diff = Math.round((today - dt) / 86400000);
    if (diff === 0) return 'Oggi';
    if (diff === 1) return 'Ieri';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  }
  // default: long
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
};

// --- Currency ---
window.formatCurrency = function (amount) {
  var n = parseFloat(amount) || 0;
  return (n >= 0 ? '+' : '') + n.toFixed(2).replace('.', ',') + ' €';
};

// --- Duration ---
window.formatDuration = function (minutes) {
  var m = parseInt(minutes, 10) || 0;
  var h = Math.floor(m / 60);
  var rem = m % 60;
  if (h > 0) return h + 'h' + (rem > 0 ? rem + 'm' : '');
  return m + 'm';
};

// --- Streak calculator ---
// items: array of objects; dateField: nome della proprietà data (string ISO)
window.calcStreak = function (items, dateField) {
  dateField = dateField || 'date';
  if (!items || !items.length) return 0;
  var dates = items.map(function (i) { return (i[dateField] || '').split('T')[0]; });
  dates = dates.filter(Boolean);
  // unique + desc
  dates = Array.from(new Set(dates)).sort().reverse();
  var streak = 0;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  for (var i = 0; i < dates.length; i++) {
    var d = new Date(dates[i]); d.setHours(0, 0, 0, 0);
    if (Math.round((today - d) / 86400000) === streak) streak++;
    else break;
  }
  return streak;
};

(function () {
  var KEY = 'crease:v1:';
  var CFG = window.CREASE || {};
  function $(id) { return document.getElementById(id); }
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(KEY + k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function prettyDate(s) { var p = s.split('-'); return MONTHS[+p[1] - 1] + ' ' + (+p[2]); }
  function baseUrl() { return location.origin === 'null' ? location.href.split(/[?#]/)[0] : location.origin + location.pathname; }

  var G = null, mode = 'daily', cur = [], hist = [], failed = 0, hints = 0, solved = false, busy = false, hintK = null;
  var els = [], cw = 40, maxV = 1, playDate = todayStr(), practiceK = 3, n0 = 8, seed = '';

  function late() { return playDate !== todayStr(); }
  function save() {
    if (mode !== 'daily') return;
    store.set('day:' + playDate, { hist: hist, failed: failed, hints: hints, solved: solved });
  }
  function replay() { var c = G.start.slice(); hist.forEach(function (k) { c = fold(c, k); }); return c; }
  function status(msg, cls) { var s = $('status'); s.textContent = msg || ''; s.className = 'status' + (cls ? ' ' + cls : ''); }
  function range(a, b) { var r = []; for (var i = a; i < b; i++) r.push(i); return r; }

  function setTile(cell, v) {
    var t = cell.firstChild, h = Math.min(1, v / maxV);
    t.textContent = v;
    t.style.setProperty('--h', h.toFixed(3));
    t.dataset.hi = h > 0.5 ? '1' : '0';
    t.style.fontSize = Math.round(cw * (v >= 100 ? 0.3 : v >= 10 ? 0.38 : 0.48)) + 'px';
  }
  function place(cell, i, len) { cell.style.left = (((n0 - len) / 2 + i) * cw) + 'px'; }

  function measure() {
    var W = $('strip').parentElement.clientWidth - 24;
    cw = Math.max(26, Math.min(54, Math.floor(W / n0)));
  }
  function buildTarget() {
    var t = $('target'); t.innerHTML = '';
    var tcw = Math.max(22, Math.min(38, Math.floor(cw * 0.78)));
    G.target.forEach(function (v) {
      var c = document.createElement('div'); c.className = 'tcell'; c.textContent = v;
      c.style.width = c.style.height = tcw + 'px';
      c.style.fontSize = Math.round(tcw * (v >= 100 ? 0.32 : v >= 10 ? 0.4 : 0.5)) + 'px';
      t.appendChild(c);
    });
  }
  function buildStrip() {
    var s = $('strip'); s.innerHTML = ''; els = [];
    s.style.width = (n0 * cw) + 'px'; s.style.height = (cw + 8) + 'px';
    cur.forEach(function (v, i) {
      var c = document.createElement('div'); c.className = 'cell';
      c.style.width = c.style.height = cw + 'px';
      var t = document.createElement('div'); t.className = 'tile'; c.appendChild(t);
      setTile(c, v); place(c, i, cur.length);
      s.appendChild(c); els.push(c);
    });
    drawCreases();
  }
  function clearWill() { els.forEach(function (e) { e.classList.remove('will'); }); }
  function drawCreases() {
    var s = $('strip');
    Array.prototype.slice.call(s.querySelectorAll('.crease')).forEach(function (e) { e.remove(); });
    if (solved || hist.length >= G.K) return;
    var len = cur.length, hit = Math.max(24, Math.round(cw * 0.6));
    for (var k = 1; k < len; k++) {
      (function (k) {
        var b = document.createElement('button'); b.className = 'crease'; b.type = 'button';
        b.style.left = (((n0 - len) / 2 + k) * cw - hit / 2) + 'px'; b.style.width = hit + 'px'; b.style.height = (cw + 8) + 'px';
        b.setAttribute('aria-label', 'Fold between cell ' + k + ' and cell ' + (k + 1));
        if (hintK === k) b.classList.add('hint');
        var shortIdx = k <= len - k ? range(0, k) : range(k, len);
        function on() { if (busy) return; shortIdx.forEach(function (i) { els[i].classList.add('will'); }); }
        b.addEventListener('mouseenter', on); b.addEventListener('focus', on);
        b.addEventListener('mouseleave', clearWill); b.addEventListener('blur', clearWill);
        b.addEventListener('click', function () { doFold(k); });
        s.appendChild(b);
      })(k);
    }
  }

  function updatePips() {
    var p = $('pips'); p.innerHTML = '<span class="pips-text">Folds</span>';
    for (var i = 0; i < G.K; i++) { var d = document.createElement('span'); d.className = 'pip' + (i < hist.length ? ' used' : ''); p.appendChild(d); }
    $('btnUndo').disabled = busy || solved || hist.length === 0;
    $('btnReset').disabled = busy || solved || hist.length === 0;
    $('btnHint').disabled = busy || solved;
  }

  async function doFold(k) {
    if (busy || solved || hist.length >= G.K) return;
    busy = true; hintK = null; clearWill(); status('');
    $('btnUndo').disabled = $('btnReset').disabled = $('btnHint').disabled = true;
    Array.prototype.slice.call($('strip').querySelectorAll('.crease')).forEach(function (e) { e.disabled = true; });
    var len = cur.length, leftShort = k <= len - k;
    var shortIdx = leftShort ? range(0, k) : range(k, len), keepIdx = leftShort ? range(k, len) : range(0, k);
    var next = fold(cur, k);
    if (!reduce) {
      shortIdx.forEach(function (i) {
        var e = els[i], dx = ((2 * k - 1 - i) - i) * cw;
        e.style.zIndex = 5;
        e.style.transition = 'transform .5s cubic-bezier(.5,0,.2,1)';
        e.style.transform = 'translateX(' + dx + 'px) rotateY(180deg)';
      });
      await sleep(540);
    }
    shortIdx.forEach(function (i) { els[i].remove(); });
    var kept = keepIdx.map(function (i) { return els[i]; });
    kept.forEach(function (e, j) {
      setTile(e, next[j]); place(e, j, next.length);
      e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop');
    });
    els = kept; cur = next; hist.push(k);
    busy = false;
    drawCreases(); updatePips();
    if (matches(cur, G.target)) { await win(); }
    else if (hist.length >= G.K) {
      failed++; status('Out of folds. Undo a fold or reset.', 'bad');
      var s = $('strip'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake');
      updatePips();
    }
    save();
  }

  async function win() {
    solved = true; hintK = null;
    els.forEach(function (e, i) { e.classList.add('won'); e.firstChild.style.animationDelay = (i * 60) + 'ms'; });
    drawCreases(); updatePips();
    status('Matched.', 'good');
    if (mode === 'daily') recordWin();
    save();
    await sleep(reduce ? 0 : 750);
    showResult();
  }

  function recordWin() {
    var st = store.get('stats') || { days: {} };
    st.days[playDate] = { solved: true, failed: failed, hints: hints, folds: G.K, late: late() };
    store.set('stats', st);
    renderStreak();
  }
  function renderStreak() {
    var st = store.get('stats'); var el = $('streak');
    if (!st || !st.days) { el.hidden = true; return; }
    var s = streaks(st.days, todayStr());
    if (s.current > 0) { el.hidden = false; el.textContent = 'Streak ' + s.current; } else { el.hidden = true; }
  }
  function emojiRow() { return '🟥'.repeat(Math.min(failed, 8)) + '🟩'; }
  function shareText() {
    if (mode === 'daily') {
      var t = 'Crease #' + dayNumber(playDate) + ' · ' + G.K + ' folds\n' + emojiRow();
      if (hints) t += '\n💡 ' + hints + (hints === 1 ? ' hint' : ' hints');
      return t + '\n' + baseUrl();
    }
    var misses = failed === 0 ? 'no misses' : failed + (failed === 1 ? ' miss' : ' misses');
    return 'I folded this Crease puzzle in ' + G.K + ' folds with ' + misses + '. Can you?\n' + baseUrl() + '?s=' + seed + '&k=' + G.K;
  }
  function showResult() {
    var r = $('result'); r.hidden = false; $('shareBox').hidden = true;
    var clean = failed === 0 && hints === 0;
    $('resTitle').textContent = clean ? 'Clean fold.' : 'Solved.';
    var bits = [G.K + ' folds', failed + (failed === 1 ? ' failed attempt' : ' failed attempts')];
    if (hints) bits.push(hints + (hints === 1 ? ' hint' : ' hints'));
    $('resLine').textContent = bits.join(' · ');
    $('resEmoji').textContent = emojiRow();
    var daily = mode === 'daily';
    $('resStats').hidden = !daily; $('resNext').hidden = !daily || late();
    $('btnShare').textContent = daily ? 'Share result' : 'Challenge a friend';
    $('btnMore').textContent = daily ? 'Keep playing' : 'New puzzle';
    if (daily) {
      var s = streaks((store.get('stats') || { days: {} }).days, todayStr());
      $('stDays').textContent = s.total; $('stStreak').textContent = s.current; $('stBest').textContent = s.best;
      tick();
    }
    r.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }
  function tick() {
    var el = $('resNext'); if (el.hidden || $('result').hidden) return;
    var now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    var ms = mid - now, h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
    el.textContent = 'Next puzzle in ' + pad2(h) + ':' + pad2(m) + ':' + pad2(s);
    if (todayStr() !== playDate) { el.textContent = 'A new puzzle is ready. Reload to play it.'; }
  }
  setInterval(tick, 1000);

  function undo() {
    if (busy || solved || !hist.length) return;
    hist.pop(); cur = replay(); hintK = null; status(''); buildStrip(); updatePips(); save();
  }
  function reset() {
    if (busy || solved || !hist.length) return;
    hist = []; cur = G.start.slice(); hintK = null; status(''); buildStrip(); updatePips(); save();
  }
  function hint() {
    if (busy || solved) return;
    var rem = G.K - hist.length;
    if (rem <= 0) { status('Undo a fold first.'); return; }
    var k = findStep(cur, G.target, rem);
    hints++;
    if (k == null) { hintK = null; status('This strip can no longer reach the target. Undo a fold.', 'bad'); }
    else { hintK = k; status('Try the highlighted crease.'); }
    drawCreases(); save();
  }

  function begin(p, tagText) {
    G = p; cur = p.start.slice(); n0 = p.start.length;
    hist = []; failed = 0; hints = 0; solved = false; busy = false; hintK = null;
    maxV = Math.max.apply(null, p.start.concat(p.target));
    $('puzzleTag').textContent = tagText;
    $('lede').innerHTML = 'Match the target in <b>' + p.K + ' folds</b>. Tap a dashed line to fold.';
    $('result').hidden = true; status('');
  }
  function render() { measure(); buildTarget(); buildStrip(); updatePips(); }

  function startDaily(date) {
    mode = 'daily'; playDate = date;
    var p = dailyPuzzle(date);
    begin(p, (late() ? 'Archive #' : 'Daily #') + dayNumber(date) + (late() ? ' · ' + prettyDate(date) : ''));
    var s = store.get('day:' + date);
    if (s && Array.isArray(s.hist)) {
      hist = s.hist.filter(function (k) { return typeof k === 'number'; }); failed = s.failed | 0; hints = s.hints | 0; solved = !!s.solved;
      cur = replay();
      if (solved && !matches(cur, G.target)) solved = false;
      if (solved) status('Matched.', 'good');
      else if (hist.length >= G.K) status('Out of folds. Undo a fold or reset.', 'bad');
    }
    $('backToday').hidden = !late();
    syncMode(); render();
    if (solved) { els.forEach(function (e) { e.classList.add('won'); }); showResult(); }
  }
  function randomSeed() { return Math.random().toString(36).slice(2, 8).padEnd(6, 'x'); }
  function startPractice(K, forcedSeed) {
    mode = 'practice'; practiceK = K; seed = forcedSeed || randomSeed();
    var p = generate('practice|' + seed, K, PRACTICE[K]);
    begin(p, forcedSeed ? 'Challenge' : 'Practice');
    $('backToday').hidden = false;
    try { history.replaceState(null, '', '?s=' + seed + '&k=' + K); } catch (e) {}
    syncMode(); render();
  }
  function syncMode() {
    $('btnDaily').setAttribute('aria-pressed', String(mode === 'daily'));
    $('btnPractice').setAttribute('aria-pressed', String(mode === 'practice'));
    $('practiceBar').hidden = mode !== 'practice';
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) { c.setAttribute('aria-pressed', String(+c.dataset.k === practiceK)); });
  }
  function goToday() {
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    startDaily(todayStr());
  }

  $('btnDaily').onclick = function () { if (mode !== 'daily' || late()) goToday(); };
  $('btnPractice').onclick = function () { if (mode !== 'practice') startPractice(practiceK); };
  $('backToday').onclick = function (e) { e.preventDefault(); goToday(); };
  $('btnMore').onclick = function () { startPractice(practiceK); };
  $('btnNew').onclick = function () { startPractice(practiceK); };
  Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) { c.onclick = function () { startPractice(+c.dataset.k); }; });
  $('btnUndo').onclick = undo; $('btnReset').onclick = reset; $('btnHint').onclick = hint;
  $('btnShare').onclick = function () {
    var txt = shareText(), box = $('shareBox'), label = $('btnShare').textContent;
    function fallback() { box.value = txt; box.hidden = false; box.focus(); box.select(); }
    function copy() {
      try {
        navigator.clipboard.writeText(txt).then(function () { $('btnShare').textContent = 'Copied'; setTimeout(function () { $('btnShare').textContent = label; }, 1600); }, fallback);
      } catch (e) { fallback(); }
    }
    var coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (coarse && navigator.share) {
      navigator.share({ text: txt }).catch(function (e) { if (!e || e.name !== 'AbortError') copy(); });
    } else { copy(); }
  };
  function openHelp() { $('help').hidden = false; $('btnCloseHelp').focus(); }
  function closeHelp() { $('help').hidden = true; store.set('seen', 1); }
  $('btnHelp').onclick = openHelp; $('btnCloseHelp').onclick = closeHelp;
  $('help').addEventListener('click', function (e) { if (e.target === $('help')) closeHelp(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('help').hidden) closeHelp(); });

  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (!busy) { render(); if (solved) els.forEach(function (e) { e.classList.add('won'); }); } }, 120); });

  var qs; try { qs = new URLSearchParams(location.search); } catch (e) { qs = { get: function () { return null; } }; }
  var qd = qs.get('d'), qsd = qs.get('s'), qk = +qs.get('k');
  renderStreak();
  if (qsd && /^[a-z0-9]{3,12}$/.test(qsd)) startPractice(PRACTICE[qk] ? qk : 3, qsd);
  else if (qd && validDate(qd) && qd <= todayStr()) startDaily(qd);
  else startDaily(todayStr());
  if (!store.get('seen')) openHelp();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && CFG.sw !== false) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();

/* ---------- Pure puzzle logic (no DOM). Tested separately in Node. ---------- */
function fold(a, k) {
  var L = a.slice(0, k), R = a.slice(k);
  if (L.length <= R.length) {
    return R.map(function (v, j) { return v + (j < k ? L[k - 1 - j] : 0); });
  }
  return L.map(function (v, i) { return v + ((k - 1 - i) < R.length ? R[k - 1 - i] : 0); });
}
function canon(a) {
  var s1 = a.join(','), s2 = a.slice().reverse().join(',');
  return s1 < s2 ? s1 : s2;
}
function matches(a, t) { return a.length === t.length && canon(a) === canon(t); }
function solveInfo(start, target, K) {
  var tk = canon(target), minDepth = Infinity, count = 0;
  (function dfs(a, d) {
    if (d > 0 && a.length === target.length && canon(a) === tk) { if (d < minDepth) minDepth = d; if (d === K) count++; }
    if (d === K || a.length < 2) return;
    for (var k = 1; k < a.length; k++) dfs(fold(a, k), d + 1);
  })(start, 0);
  return { minDepth: minDepth, count: count };
}
function reach(a, t, rem) {
  for (var k = 1; k < a.length; k++) {
    var n = fold(a, k);
    if (matches(n, t)) return true;
    if (rem > 1 && n.length > 1 && reach(n, t, rem - 1)) return true;
  }
  return false;
}
function findStep(a, t, rem) {
  for (var k = 1; k < a.length; k++) {
    var n = fold(a, k);
    if (matches(n, t)) return k;
    if (rem > 1 && n.length > 1 && reach(n, t, rem - 1)) return k;
  }
  return null;
}
function hashSeed(str) {
  var h = 1779033703 ^ str.length;
  for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
function makeRng(seed) {
  var a = hashSeed(seed);
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function generate(seed, K, n) {
  var rng = makeRng(seed);
  for (var t = 0; t < 4000; t++) {
    var start = [];
    for (var i = 0; i < n; i++) start.push(1 + Math.floor(rng() * 9));
    var cur = start.slice();
    for (var s = 0; s < K; s++) cur = fold(cur, 1 + Math.floor(rng() * (cur.length - 1)));
    if (cur.length < 3) continue;
    var info = solveInfo(start, cur, K);
    if (info.minDepth !== K) continue;
    var maxSol = t < 300 ? 1 : (t < 1200 ? 2 : 99);
    if (info.count > maxSol) continue;
    return { start: start, target: cur, K: K, tries: t, solutions: info.count };
  }
  throw new Error('no puzzle for ' + seed);
}
var DAILY = [ // indexed by weekday, Sunday = 0
  { K: 4, n: 10 }, { K: 2, n: 7 }, { K: 2, n: 8 }, { K: 3, n: 8 }, { K: 3, n: 9 }, { K: 3, n: 10 }, { K: 4, n: 11 }
];
var PRACTICE = { 2: 7, 3: 9, 4: 10 };
function dailyPuzzle(dateStr) {
  var p = dateStr.split('-').map(Number), dow = new Date(p[0], p[1] - 1, p[2]).getDay(), c = DAILY[dow];
  return generate('crease|' + dateStr, c.K, c.n);
}
function dayNumber(dateStr) {
  var p = dateStr.split('-').map(Number);
  return Math.max(1, Math.round((Date.UTC(p[0], p[1] - 1, p[2]) - Date.UTC(2026, 9, 24)) / 864e5) + 1);
}
function prevDay(dateStr) {
  var p = dateStr.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2] - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
var MIN_DATE = '2026-10-24';
function pad2(n) { return String(n).padStart(2, '0'); }
function dateOfNumber(n) {
  var d = new Date(Date.UTC(2026, 9, 24 + n - 1));
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}
function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && dateOfNumber(dayNumber(s)) === s && s >= MIN_DATE; }
function solutions(start, target, K) {
  var out = [];
  (function dfs(a, d, path) {
    if (d === K) { if (matches(a, target)) out.push(path.slice()); return; }
    if (a.length < 2) return;
    for (var k = 1; k < a.length; k++) { path.push(k); dfs(fold(a, k), d + 1, path); path.pop(); }
  })(start, 0, []);
  return out;
}
function streaks(days, today) {
  function ok(k) { return days[k] && days[k].solved && !days[k].late; }
  var cur = 0, d = ok(today) ? today : prevDay(today);
  while (ok(d)) { cur++; d = prevDay(d); }
  var keys = Object.keys(days).filter(ok).sort(), best = 0, run = 0, last = null;
  keys.forEach(function (k) { run = (last && prevDay(k) === last) ? run + 1 : 1; last = k; if (run > best) best = run; });
  var total = Object.keys(days).filter(function (k) { return days[k] && days[k].solved; }).length;
  return { current: cur, best: best, total: total };
}
if (typeof module !== 'undefined') module.exports = { fold: fold, canon: canon, matches: matches, solveInfo: solveInfo, findStep: findStep, generate: generate, dailyPuzzle: dailyPuzzle, dayNumber: dayNumber, dateOfNumber: dateOfNumber, validDate: validDate, solutions: solutions, streaks: streaks, DAILY: DAILY, PRACTICE: PRACTICE, MIN_DATE: MIN_DATE, prevDay: prevDay };

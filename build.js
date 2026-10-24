#!/usr/bin/env node
/* Crease site builder. No dependencies. Run: node build.js
 * Env (all optional):
 *   SITE_URL         e.g. https://crease.pages.dev   (used for canonical links, sitemap, share previews)
 *   ADSENSE_CLIENT   e.g. ca-pub-1234567890123456    (adds Google AdSense auto ads + ads.txt)
 *   CF_BEACON_TOKEN  Cloudflare Web Analytics token  (free, cookie-free traffic stats)
 *   CONTACT_EMAIL    shown on About/Privacy (ad networks want a contact)
 *   TODAY            override the build date (YYYY-MM-DD, UTC) for testing
 */
const fs = require('fs'), path = require('path');
const L = require('./src/logic.js');

const SITE = (process.env.SITE_URL || 'https://example.com').replace(/\/+$/, '');
const ADS = process.env.ADSENSE_CLIENT || '';
const CF = process.env.CF_BEACON_TOKEN || '';
const EMAIL = process.env.CONTACT_EMAIL || '';
const TODAY = process.env.TODAY || new Date().toISOString().slice(0, 10);
const OUT = path.join(__dirname, 'dist');
const LATEST = Math.max(1, L.dayNumber(TODAY));
const ANSWER_LAG = 2; // answers go live two days after a puzzle, so nobody in any time zone gets spoiled
const LAST_ANSWER = LATEST - ANSWER_LAG;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const write = (p, c) => { const f = path.join(OUT, p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); };
const read = p => fs.readFileSync(path.join(__dirname, p), 'utf8');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function parts(s) { const p = s.split('-').map(Number); return { y: p[0], m: p[1], d: p[2], dow: new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay() }; }
const longDate = s => { const p = parts(s); return `${DAYS[p.dow]}, ${MONTHS[p.m - 1]} ${p.d}, ${p.y}`; };
const shortDate = s => { const p = parts(s); return `${MONTHS[p.m - 1].slice(0, 3)} ${p.d}`; };
const kFor = s => L.DAILY[parts(s).dow].K;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TAGLINE = 'Crease is a free daily folding puzzle. Fold a strip of numbers until it matches the target. New puzzle every day.';

function head({ title, desc, canon, depth, ld, noindex }) {
  const rel = '../'.repeat(depth), url = SITE + canon;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta property="og:type" content="website">
<meta property="og:site_name" content="Crease">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og.png">
<meta name="theme-color" content="#131A2A">
<link rel="icon" href="${rel}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${rel}icon-192.png">
<link rel="manifest" href="${rel}manifest.webmanifest">
<link rel="alternate" type="application/rss+xml" title="Crease" href="${rel}feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Instrument+Sans:wght@400..600&family=JetBrains+Mono:wght@500;700&display=swap">
<link rel="stylesheet" href="${rel}style.css?v=${TODAY}">
${ADS ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(ADS)}" crossorigin="anonymous"></script>\n` : ''}${CF ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${esc(CF)}"}'></script>\n` : ''}${(ld || []).map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
</head>`;
}
const NAV = (depth, cur) => {
  const r = '../'.repeat(depth);
  const a = (href, label, key) => `<a href="${r}${href}"${cur === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="sitenav" aria-label="Site">${a('', 'Play', 'play')}${a('archive/', 'Archive', 'archive')}${a('how-to-play.html', 'Strategy', 'how')}${a('answers/', 'Answers', 'answers')}${a('about.html', 'About', 'about')}</nav>`;
};
const FOOT = depth => { const r = '../'.repeat(depth); return `<footer>Crease &middot; <a href="${r}about.html">About</a> &middot; <a href="${r}privacy.html">Privacy</a> &middot; <a href="${r}feed.xml">RSS</a></footer>`; };
function docPage({ title, desc, canon, depth = 0, cur, body, ld, noindex }) {
  const r = '../'.repeat(depth);
  return head({ title, desc, canon, depth, ld, noindex }) + `
<body>
<div class="app doc">
<header><a class="logo" href="${r}">Crease</a></header>
${NAV(depth, cur)}
${body}
${FOOT(depth)}
</div>
</body>
</html>
`;
}

/* ---------- mini strips ---------- */
function mini(arr, opts = {}) {
  let h = `<span class="mini${opts.sm ? ' sm' : ''}">`;
  arr.forEach((v, i) => { if (opts.crease === i) h += '<s></s>'; h += `<i${opts.target ? ' class="t"' : ''}>${v}</i>`; });
  return h + '</span>';
}

/* ---------- 1. the game page ---------- */
const faq = [
  ['What is Crease?', 'Crease is a free daily puzzle game. You get a strip of numbered cells and a target strip. You fold the strip at the creases between cells, the shorter side flips over the longer side, and numbers that land on each other add up. Match the target using exactly the folds you are given.'],
  ['When does the new puzzle appear?', 'At midnight in your own time zone. Everyone gets the same puzzle for the same calendar date, so you can compare results with friends.'],
  ['How hard is it?', 'It scales through the week. Mondays and Tuesdays need 2 folds, midweek puzzles need 3, and Saturdays and Sundays need 4. Every puzzle is checked by a solver, so each one is solvable in exactly the stated number of folds.'],
  ['Can I play past puzzles?', 'Yes. The archive has every past puzzle. Archive plays do not count toward your daily streak. There is also an endless Practice mode with three difficulty levels.'],
  ['Does it work offline?', 'Yes. Open Crease in your phone browser and use Add to Home Screen. After the first visit it runs without a connection.'],
  ['Is there a trick to solving it?', 'Several. Start with the length budget: each fold removes as many cells as the shorter side has. The Strategy page walks through the best tricks with examples.']
];
const aboutBlock = `
  <section class="about" aria-labelledby="about-h">
    <h2 id="about-h">A daily puzzle about folding paper</h2>
    <p>Crease turns paper folding into arithmetic. Every day there is one new strip of numbers and one target to hit. The numbers you fold on top of each other add together, so each fold both shortens the strip and builds bigger totals. Hitting the target takes a mix of counting and planning ahead.</p>
    <p>Stuck? Read the <a href="how-to-play.html">strategy guide</a>, browse <a href="archive/">past puzzles</a>, or check the <a href="answers/">answers archive</a> after a puzzle is two days old.</p>
    <h2>Questions</h2>
    <div class="faq">
${faq.map(([q, a]) => `      <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
    </div>
  </section>`;
const gameLd = [{
  '@context': 'https://schema.org', '@type': 'VideoGame', name: 'Crease', description: TAGLINE, url: SITE + '/',
  genre: 'Puzzle', gamePlatform: 'Web browser', applicationCategory: 'Game', operatingSystem: 'Any', inLanguage: 'en',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
}, {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
}];
{
  let body = read('src/game-body.html').replace('<footer>', aboutBlock + '\n  <footer>');
  body = body.replace('<footer>A new Crease every day. Fold carefully.</footer>', FOOT(0));
  const cfg = JSON.stringify({ site: SITE, built: TODAY });
  write('index.html', head({ title: 'Crease: a daily folding puzzle game', desc: TAGLINE, canon: '/', depth: 0, ld: gameLd }) + `
<body>
${body}
<noscript><p style="padding:16px">Crease needs JavaScript to run. It is a small puzzle game with no tracking and no sign-up.</p></noscript>
<script>window.CREASE=${cfg};</script>
<script src="logic.js?v=${TODAY}"></script>
<script src="app.js?v=${TODAY}"></script>
</body>
</html>
`);
}
['style.css', 'logic.js', 'app.js'].forEach(f => write(f, read('src/' + f)));

/* ---------- 2. archive ---------- */
{
  let items = '';
  for (let n = LATEST; n >= 1; n--) {
    const d = L.dateOfNumber(n), p = parts(d);
    items += `<li data-date="${d}"><a href="../?d=${d}"><b>#${n}</b><span>${DAYS[p.dow].slice(0, 3)} ${shortDate(d)} &middot; ${kFor(d)} folds</span></a></li>\n`;
  }
  write('archive/index.html', docPage({
    title: 'Crease puzzle archive: every daily puzzle', canon: '/archive/', depth: 1, cur: 'archive',
    desc: 'Play every past Crease puzzle. Pick a date, fold the strip, and see how many days you have solved.',
    body: `<h1>Puzzle archive</h1>
<p>Every Crease puzzle so far. Solved puzzles get a check mark. Archive plays do not count toward your daily streak.</p>
<div class="tools"><a class="btn primary" href="../">Play today's puzzle</a></div>
<ul class="archive" id="archive">
${items}</ul>
<script>(function(){try{var s=JSON.parse(localStorage.getItem('crease:v1:stats'));if(!s||!s.days)return;document.querySelectorAll('#archive li').forEach(function(li){var d=s.days[li.dataset.date];if(d&&d.solved)li.className='done';});}catch(e){}})();</script>`
  }));
}

/* ---------- 3. answers ---------- */
function answerPage(n) {
  const date = L.dateOfNumber(n), p = L.dailyPuzzle(date), sols = L.solutions(p.start, p.target, p.K);
  const sum = p.start.reduce((a, b) => a + b, 0), removed = p.start.length - p.target.length;
  const first = sols[0];
  const ord = k => `between cell ${k} and cell ${k + 1}`;
  function walk(sol) {
    let c = p.start.slice(), out = '';
    sol.forEach((k, i) => {
      const nx = L.fold(c, k), last = i === sol.length - 1;
      out += `<div class="step"><span class="lbl">Fold ${i + 1} of ${sol.length}</span>
  <div class="row">${mini(c, { crease: k, sm: true })}<span class="arrow">&rarr;</span>${mini(nx, { sm: true, target: last })}</div>
  <span>Fold ${ord(k)}. The ${k <= c.length - k ? 'left' : 'right'} side flips over the ${k <= c.length - k ? 'right' : 'left'} side${k === c.length - k ? ' (both sides are the same length, so either direction gives the same strip)' : ''}.</span></div>\n`;
      c = nx;
    });
    return out;
  }
  const title = `Crease #${n} answer and solution (${MONTHS[parts(date).m - 1]} ${parts(date).d}, ${parts(date).y})`;
  const desc = `Solution to Crease puzzle #${n} from ${longDate(date)}: fold ${p.start.join(' ')} into ${p.target.join(' ')} in ${p.K} folds. Hints and a full step by step answer.`;
  const prev = n > 1 ? `<a href="${n - 1}.html">&larr; Answer #${n - 1}</a>` : '<span></span>';
  const next = n < LAST_ANSWER ? `<a href="${n + 1}.html">Answer #${n + 1} &rarr;</a>` : '<span></span>';
  write(`answers/${n}.html`, docPage({
    title, desc, canon: `/answers/${n}.html`, depth: 1, cur: 'answers',
    ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: title, datePublished: date, description: desc, mainEntityOfPage: `${SITE}/answers/${n}.html`, author: { '@type': 'Organization', name: 'Crease' } }],
    body: `<p class="crumbs"><a href="../">Crease</a> / <a href="./">Answers</a> / #${n}</p>
<h1>Crease #${n} answer</h1>
<p class="meta">${longDate(date)} &middot; ${p.K} folds</p>
<p>This is the solution to Crease puzzle #${n}. The puzzle gives you a strip of ${p.start.length} numbers and asks you to fold it ${p.K} times to reach a strip of ${p.target.length} numbers.</p>
<div class="step"><span class="lbl">Start</span><div class="row">${mini(p.start)}</div><span class="lbl">Target</span><div class="row">${mini(p.target, { target: true })}</div></div>
<a class="btn primary cta" href="../?d=${date}">Play this puzzle first</a>
<h2>Hints</h2>
<details><summary>Hint 1: the numbers</summary><p>Folding only adds numbers together, so the total never changes. Both strips add up to ${sum}. Your largest target number, ${Math.max(...p.target)}, must be a stack of several cells added together.</p></details>
<details><summary>Hint 2: the length budget</summary><p>The strip has ${p.start.length} cells and the target has ${p.target.length}, so the folds together must remove ${removed} cells. A fold removes as many cells as its shorter side has.</p></details>
<details><summary>Hint 3: the first fold</summary><p>The first fold goes ${ord(first[0])}, counting cells from the left.</p></details>
<h2>Full solution</h2>
<details><summary>Show every fold</summary>
<div class="steps">
${walk(first)}</div>
${sols.length > 1 ? `<p>There is another valid fold order: ${sols.slice(1).map(s => s.map(k => ord(k)).join(', then ')).join('; or ')}.</p>` : ''}
</details>
<div class="pager">${prev}${next}</div>`
  }));
}
for (let n = 1; n <= LAST_ANSWER; n++) answerPage(n);
{
  let list = '';
  for (let n = LAST_ANSWER; n >= 1; n--) { const d = L.dateOfNumber(n); list += `<li><a href="../answers/${n}.html"><b>#${n}</b><span>${shortDate(d)} &middot; ${kFor(d)} folds</span></a></li>\n`; }
  write('answers/index.html', docPage({
    title: 'Crease answers: solutions to every daily puzzle', canon: '/answers/', depth: 1, cur: 'answers',
    desc: 'Hints and full solutions for every Crease puzzle, posted two days after each puzzle so nobody gets spoiled.',
    body: `<h1>Crease answers</h1>
<p>Hints and full solutions for past puzzles. Answers go up two days after the puzzle, so players in every time zone get to solve it first. Each page starts with gentle hints before the full answer.</p>
${LAST_ANSWER >= 1 ? `<ul class="archive">\n${list}</ul>` : '<p>The first answers will appear two days after the first puzzle. Check back soon.</p>'}
<a class="btn primary cta" href="../">Play today's puzzle</a>`
  }));
}

/* ---------- 4. strategy, about, privacy, 404 ---------- */
write('how-to-play.html', docPage({
  title: 'How to play Crease and strategy tips', canon: '/how-to-play.html', depth: 0, cur: 'how',
  desc: 'The rules of Crease and six strategy tips for solving the daily folding puzzle, with worked examples.',
  ld: [{ '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to play Crease', step: [
    { '@type': 'HowToStep', text: 'Tap a dashed line between two cells to fold the strip there.' },
    { '@type': 'HowToStep', text: 'The shorter side flips over the longer side and overlapping numbers add up.' },
    { '@type': 'HowToStep', text: 'Match the target strip using all of your folds. A reversed match counts.' }] }],
  body: `<h1>How to play Crease</h1>
<h2>The rules</h2>
<ol>
<li>You get a strip of numbered cells and a target strip.</li>
<li>Tap a dashed line between two cells to fold there. The shorter side flips over the longer side. If both sides are equal, either gives the same strip.</li>
<li>Cells that land on each other add together.</li>
<li>Match the target using all of your folds. A flipped (reversed) match counts.</li>
<li>Run out of folds without matching and that is a failed attempt. Undo and reset are free. Hints are shown when you share your result.</li>
</ol>
<div class="step"><span class="lbl">Worked example</span><div class="row">${mini([2, 5, 1, 3], { crease: 2 })}<span class="arrow">&rarr;</span>${mini([6, 5], { target: true })}</div><span>Fold in the middle. The 5 lands on the 1 and the 2 lands on the 3, giving 6 and 5.</span></div>
<h2>Six strategy tips</h2>
<ol>
<li><b>Check the total.</b> Folding never changes the sum, so the start and target add up to the same number. If a plan breaks that, it is wrong.</li>
<li><b>Count the length budget.</b> A fold removes as many cells as its shorter side. If the strip has 10 cells, the target has 4, and you have 3 folds, the folds must remove 6 cells between them. That limits which creases are possible.</li>
<li><b>Work backwards from the biggest target number.</b> It is a stack of cells that were folded onto each other. Look for cells in the start strip that add up to it and sit at mirrored distances from one crease.</li>
<li><b>Fold near the ends early.</b> Folding a short end removes few cells and keeps options open. Big folds in the middle use up the length budget fast.</li>
<li><b>Use the mirror rule.</b> A fold at one crease pairs the cell just left of it with the cell just right of it, then the next pair outward, and so on. Write the pairs down before you tap.</li>
<li><b>Remember the flip.</b> The target can match in either direction, so you have two chances to line up your last fold.</li>
</ol>
<a class="btn primary cta" href="./">Play today's puzzle</a>`
}));
const mail = EMAIL ? `<a href="mailto:${esc(EMAIL)}">${esc(EMAIL)}</a>` : 'the site owner (add a contact email by setting CONTACT_EMAIL when you build)';
write('about.html', docPage({
  title: 'About Crease', canon: '/about.html', depth: 0, cur: 'about',
  desc: 'Crease is a free daily folding puzzle. Learn how it works and how the puzzles are made.',
  body: `<h1>About Crease</h1>
<p>Crease is a free daily puzzle game about folding a strip of numbers. It has no accounts, no sign-up and no tracking of what you do in the game.</p>
<h2>How the puzzles are made</h2>
<p>Each day's puzzle is generated from the date by a program. The program picks a random strip, folds it a few times to make the target, then runs a solver to confirm the puzzle can be solved in exactly that many folds and has very few solutions. Every player gets the same puzzle on the same date.</p>
<h2>Contact</h2>
<p>Questions or bug reports: ${mail}.</p>`
}));
write('privacy.html', docPage({
  title: 'Crease privacy policy', canon: '/privacy.html', depth: 0, cur: '',
  desc: 'What Crease stores, what third parties may collect, and how to contact us.',
  body: `<h1>Privacy policy</h1>
<p class="meta">Last updated ${TODAY}</p>
<h2>What the game stores</h2>
<p>Crease saves your progress, streak and statistics in your own browser using local storage. This data stays on your device. We do not receive it and we do not have accounts.</p>
<h2>Analytics</h2>
<p>${CF ? 'This site uses Cloudflare Web Analytics to count visits. It does not use cookies or track individual people across sites.' : 'This site may use a privacy-friendly analytics service that counts visits without cookies.'}</p>
<h2>Advertising</h2>
<p>${ADS ? 'This site shows ads served by Google AdSense. Google and its partners may use cookies to show ads based on your visits to this and other sites. You can manage ad personalization at <a href="https://adssettings.google.com">adssettings.google.com</a> or learn more at <a href="https://policies.google.com/technologies/ads">policies.google.com/technologies/ads</a>.' : 'This site may show ads from third-party networks in the future. If it does, those networks may use cookies, and this page will be updated to say so.'}</p>
<h2>Fonts</h2>
<p>Pages load fonts from Google Fonts, which receives your IP address when the fonts are requested.</p>
<h2>Contact</h2>
<p>Questions about this policy: ${mail}.</p>`
}));
write('404.html', docPage({
  title: 'Page not found | Crease', canon: '/404.html', depth: 0, cur: '', noindex: true, desc: 'Page not found.',
  body: `<h1>That page is not here</h1><p>It may have been folded away.</p><a class="btn primary cta" href="${SITE}/">Play today's puzzle</a>`
}));

/* ---------- 5. feeds, sitemap, PWA ---------- */
{
  const urls = ['/', '/archive/', '/answers/', '/how-to-play.html', '/about.html', '/privacy.html'];
  for (let n = 1; n <= LAST_ANSWER; n++) urls.push(`/answers/${n}.html`);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
  let items = '';
  for (let n = LATEST; n >= Math.max(1, LATEST - 29); n--) {
    const d = L.dateOfNumber(n);
    items += `<item><title>Crease #${n} (${longDate(d)})</title><link>${SITE}/?d=${d}</link><guid isPermaLink="false">crease-${n}</guid><pubDate>${new Date(d + 'T00:00:00Z').toUTCString()}</pubDate><description>Today's Crease needs ${kFor(d)} folds. Can you match the target?</description></item>\n`;
  }
  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Crease</title><link>${SITE}/</link><description>${esc(TAGLINE)}</description>\n${items}</channel></rss>\n`);
  write('manifest.webmanifest', JSON.stringify({
    name: 'Crease', short_name: 'Crease', description: TAGLINE, start_url: './', scope: './', display: 'standalone',
    background_color: '#131A2A', theme_color: '#131A2A', categories: ['games', 'puzzle'],
    icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }]
  }, null, 2));
  write('sw.js', `const V='crease-${TODAY}';
const SHELL=['./','index.html','style.css?v=${TODAY}','logic.js?v=${TODAY}','app.js?v=${TODAY}','favicon.svg','manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open(V).then(h=>h.put(r,c));return x;}).catch(()=>caches.match(r).then(m=>m||caches.match('./'))));return;}
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(x=>{const c=x.clone();caches.open(V).then(h=>h.put(r,c));return x;})));
});
`);
  if (ADS) write('ads.txt', `google.com, ${ADS.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
  if (fs.existsSync(path.join(__dirname, 'assets'))) fs.readdirSync(path.join(__dirname, 'assets')).forEach(f => fs.copyFileSync(path.join(__dirname, 'assets', f), path.join(OUT, f)));
}
console.log(`Built Crease for ${TODAY}: puzzle #${LATEST}, ${Math.max(0, LAST_ANSWER)} answer pages -> ${OUT}`);

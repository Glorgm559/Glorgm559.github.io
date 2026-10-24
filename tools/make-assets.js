// One-off: renders icon-192.png, icon-512.png and og.png into ./assets (needs playwright). Output is committed, so the daily build needs no dependencies.
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const A = path.join(__dirname, '..', 'assets'); const svg = fs.readFileSync(path.join(A, 'favicon.svg'), 'utf8');
const tile = (v, hi) => `<div class="t${hi ? ' hi' : ''}">${v}</div>`;
const og = `<html><body style="margin:0"><style>
body{width:1200px;height:630px;background:#131A2A;color:#E9EFFA;font-family:'Inter Display','Inter',sans-serif;position:relative;overflow:hidden;
background-image:linear-gradient(#1B2640 1px,transparent 1px),linear-gradient(90deg,#1B2640 1px,transparent 1px);background-size:40px 40px}
h1{position:absolute;left:84px;top:96px;margin:0;font-size:230px;font-weight:800;letter-spacing:-9px;line-height:1}
p{position:absolute;left:92px;top:350px;margin:0;font-size:46px;color:#8F9CB8;font-weight:500}
.row{position:absolute;left:92px;display:flex;gap:10px;align-items:center;font-family:'DejaVu Sans Mono',monospace;font-weight:700}
.t{width:76px;height:76px;border-radius:12px;background:#F8FAFD;color:#131A2A;display:grid;place-items:center;font-size:36px;box-shadow:0 5px 0 #2a3550}
.t.hi{background:#7189FF;color:#0B101B}.t.out{border:4px solid #E9EFFA;background:transparent;color:#E9EFFA;box-shadow:none}
.c{width:0;height:96px;border-left:5px dashed #8794AF;margin:0 6px}.arr{font-size:44px;color:#8F9CB8;margin:0 14px}
</style><h1>Crease</h1><p>The daily folding puzzle</p>
<div class="row" style="top:450px">${tile(4)}${tile(1)}${tile(5)}<div class="c"></div>${tile(7)}${tile(4)}${tile(9,1)}<span class="arr">&rarr;</span><div class="t out" style="width:96px">34</div><div class="t out" style="width:96px">13</div><div class="t out">7</div></div></body></html>`;
(async () => {
  const b = await chromium.launch();
  for (const s of [192, 512]) { const p = await b.newPage({ viewport: { width: s, height: s } }); await p.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body>`); await p.screenshot({ path: path.join(A, `icon-${s}.png`) }); }
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } }); await p.setContent(og); await p.screenshot({ path: path.join(A, 'og.png') });
  await b.close();
})();

// Verifies every relative link/asset in dist resolves, and every sitemap URL exists.
const fs=require('fs'),path=require('path');const D=path.join(__dirname,'..','dist');let bad=0,n=0;
(function walk(d){for(const f of fs.readdirSync(d)){const p=path.join(d,f);if(fs.statSync(p).isDirectory())walk(p);else if(p.endsWith('.html')){
  const h=fs.readFileSync(p,'utf8');for(const m of h.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)){const u=m[1];if(/^(https?:|mailto:|data:)/.test(u))continue;n++;
    const t=u.split('?')[0];let abs=t.startsWith('/')?path.join(D,t):path.join(path.dirname(p),t);if(abs.endsWith('/'))abs=path.join(abs,'index.html');if(!fs.existsSync(abs)){bad++;console.log('BROKEN',path.relative(D,p),'->',u);}}}}})(D);
const sm=fs.readFileSync(path.join(D,'sitemap.xml'),'utf8');for(const m of sm.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)){n++;let t=m[1];if(t.endsWith('/'))t+='index.html';if(!fs.existsSync(path.join(D,t))){bad++;console.log('SITEMAP MISSING',t);}}
console.log(`checked ${n} links, ${bad} broken`);process.exit(bad?1:0);

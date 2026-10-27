'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const files = ['index.html', 'agent-station-demo.html', 'assets/brand/uss-theseus.svg',
  'css/style.css', 'css/app.css', 'css/overseer-setup.css', 'app/app.js',
  'app/stationui.js', 'app/hudmode.js', 'app/titlebar.js', 'app/build.js',
  'app/chat.js', 'app/places.js', 'app/systems.js'];
for (const file of files) {
  const source = fs.readFileSync(path.join(root, 'frontend', file), 'utf8');
  let copy = fs.readFileSync(path.join(root, 'website', 'app', file), 'utf8');
  if (file === 'index.html') {
    copy = copy.replace(
      /<link rel="stylesheet" href="demo\.css\?v=[^"]+">[^\r\n]*\r?\n<script src="demo-boot\.js\?v=[^"]+"><\/script>[^\r\n]*\r?\n/,
      ''
    );
  }
  assert.equal(copy, source, file + ' mirrored');
}
for (const file of ['index.html', 'agent-station-demo.html']) {
  const html = fs.readFileSync(path.join(root, 'frontend', file), 'utf8');
  assert.ok(html.includes('<title>USS Theseus</title>'));
  assert.ok(html.includes('aria-label="DRUIDESS — USS THESEUS — EST. 2026"'));
  assert.ok(html.includes('CONNECT STARNET ACCOUNT'), 'real account service retains its identity');
  assert.ok(html.includes('https://www.starnetos.com/pricing'), 'subscription URL unchanged');
  assert.ok(html.includes('id="btn-starnet-link"'), 'existing account wiring unchanged');
  assert.ok(html.includes('class="ov-wordmark" role="img" aria-label="StarNet"'), 'provider mark remains separate from ship mark');
}
const logo = fs.readFileSync(path.join(root, 'frontend/assets/brand/uss-theseus.svg'), 'utf8');
assert.ok(logo.includes('viewBox="0 0 1006 168"'));
assert.ok(logo.includes('DRUIDESS') && logo.includes('USS THESEUS') && logo.includes('EST. 2026'));
assert.ok(!/[█╗╔║═╝╚]/.test(logo), 'block artwork uses fixed paths, never font fallback metrics');
assert.equal((logo.match(/<text /g) || []).length, 2, 'only the two plain ASCII captions use text');
assert.ok(!/<(?:script|image|foreignObject)\b/.test(logo), 'banner is self-contained vector art');
const css = fs.readFileSync(path.join(root, 'frontend/css/style.css'), 'utf8');
assert.ok(css.includes('aspect-ratio: 1006 / 168'));
assert.ok(css.includes('uss-theseus.svg?v=2'));
const app = fs.readFileSync(path.join(root, 'frontend/app/app.js'), 'utf8');
assert.ok(app.includes('aboard the USS Theseus'));
assert.ok(app.includes('You run on the StarNet harness'), 'runtime identity remains truthful');
assert.ok(app.includes("'/api/credits/link/start'"), 'backend route unchanged');
console.log('theseus-branding: mirrored ship identity, aligned vector banner, and preserved Starnet services PASS');

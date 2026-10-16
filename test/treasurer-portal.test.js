'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const portal = require('../frontend/app/windows/treasurer.js');

const status = {
  caps: { perRun: 0, perAgent: 0, perDay: 25, global: 0 },
  accounting: { complete: true, durable: true },
  spentToday: 4, lifetime: 10, live: 2, unsettled: [],
};
const text = portal.summary(status);
const strictFinance = {
  enabled: true, mode: 'local-only', localModels: ['qwen3.5:4b'], positiveCostAdapters: 0,
  accountingKnown: true, periods: {
    day: { period: '2026-10-16', spent: 0, cap: 50, remaining: 50 },
    week: { period: '2026-10-12', spent: 0, cap: 500, remaining: 500 },
    month: { period: '2026-10', spent: 0, cap: 1000, remaining: 1000 },
  },
};
const active = portal.summary({ ...status, strictFinance });
assert.match(active, /STRICT FINANCE ACTIVE - LOCAL ONLY/);
assert.match(active, /Paid\/unknown-cost operations: BLOCKED before dispatch/);
assert.match(active, /MONTH 2026-10: recorded \$0.00 \/ cap \$1000.00 \/ remaining \$1000.00/);
assert.match(active, /No paid reservation path/);
assert.match(portal.summary({ ...status, strictFinance: { ...strictFinance, accountingKnown: false, periods: null } }), /Calendar accounting: UNKNOWN/);
assert.throws(() => portal.summary({ ...status, strictFinance: { ...strictFinance, periods: {} } }), /cannot be verified/);
assert.match(text, /trailing 24 hours: \$4.00/);
assert.match(text, /lifetime spend: \$10.00/);
assert.match(text, /not a reservation\): \$2.00/);
assert.match(text, /Per run: UNLIMITED/);
assert.match(text, /Trailing 24 hours: \$25.00/);
assert.match(text, /compliance: UNKNOWN/);
assert.match(portal.summary({ ...status, spentToday: 0 }), /trailing 24 hours: \$0.00/);
for (const accounting of [{ complete: false, durable: true }, { complete: true, durable: false }]) {
  const unknown = portal.summary({ ...status, accounting, spentToday: null, lifetime: null, live: null, unsettled: [{}] });
  assert.match(unknown, /trailing 24 hours: UNKNOWN/);
  assert.match(unknown, /receipts: 1/);
  assert.match(unknown, /cannot certify compliance/);
  assert.doesNotMatch(unknown, /spend: \$0.00/);
}
for (const bad of [null, {}, { ...status, caps: {} }, { ...status, accounting: {} },
  { ...status, live: NaN }, { ...status, spentToday: null }, { ...status, unsettled: null },
  { ...status, caps: { ...status.caps, perDay: -1 } }]) {
  assert.throws(() => portal.summary(bad), /cannot be verified/);
}
assert.equal(portal.isPortal('treasurer'), false, 'old AI id is not silently redirected');
assert.equal(portal.isPortal('portal-treasurer'), true);
assert.equal(portal.isPortal('chief'), false);

async function main() {
  let definition, changed, unsubscribed = 0;
  const spawned = [], removed = [], opened = [], requests = [], portalLists = [];
  let props = [{ t: 'desk', agentId: portal.avatarId }];
  const elements = Object.fromEntries(['refresh', 'controls', 'message', 'summary', 'policy'].map(key => [key, { textContent: '', disabled: false }]));
  const body = { isConnected: true, innerHTML: '', querySelector: selector => elements[selector.match(/finance-(\w+)/)[1]] };
  let reply = status;
  const context = vm.createContext({
    setInterval: () => 1, clearInterval() {},
    module: { exports: {} }, DATA: { DEFAULT_SKIN: 'blank' },
    World: { spawnAgent: (...args) => spawned.push(args), despawnAgent: id => removed.push(id) },
    StationUI: {
      setCrewPortals: entries => portalLists.push(entries),
      registerWindow: (...args) => { definition = args; },
      openTerm: (...args) => opened.push(args),
    },
    Harness: { api: { get: async url => {
      requests.push(url);
      if (reply instanceof Error) throw reply;
      return reply;
    } } },
  });
  const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'app', 'windows', 'treasurer.js'), 'utf8');
  vm.runInContext(source, context);
  const ui = context.module.exports;
  const station = {
    props: () => props, capForProp: t => t === 'desk' ? 'computer' : 'cabinet',
    onChange: fn => { changed = fn; return () => { unsubscribed++; }; },
  };
  ui.init(station);
  assert.equal(spawned[0][0].id, portal.avatarId);
  assert.equal(spawned[0][0].name, 'TREASURER');
  assert.equal(spawned[0][1].atWorkstation, true, 'avatar starts at its Bridge workstation');
  assert.equal(spawned[0][0].model, undefined, 'visual identity has no model configuration');
  assert.equal(portalLists[0][0].id, portal.avatarId);
  portalLists[0][0].open();
  assert.deepEqual(opened.pop(), ['treasurer'], 'crew entry opens the portal, not COMMS');
  props = [];
  changed();
  assert.deepEqual(removed, [portal.avatarId], 'reclaiming the desk removes the service avatar');
  assert.equal(portalLists[1].length, 0, 'removing the workstation also removes the crew portal');
  ui.init(station);
  assert.equal(unsubscribed, 1, 'reinitialization replaces the previous station subscription');
  assert.equal(ui.openFor('chief'), false);
  assert.equal(ui.openFor(portal.avatarId), true);
  assert.deepEqual(opened.pop(), ['treasurer']);
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'app', 'app.js'), 'utf8');
  const resolver = appSource.match(/function openWorldAgent\(agentId\) \{[\s\S]*?\n  \}/);
  assert(resolver);
  const resolveClick = new Function('TreasurerPortal', 'liveAgents', 'StationUI', resolver[0] + '; return openWorldAgent;')(
    ui, () => [{ id: 'chief' }], { openAgent: i => opened.push(['agent', i]) }
  );
  assert.equal(resolveClick(portal.avatarId), true);
  assert.deepEqual(opened.pop(), ['treasurer'], 'avatar click opens finance, not an AI dossier');
  assert.equal(resolveClick('chief'), true);
  assert.deepEqual(opened.pop(), ['agent', 0], 'normal agent clicks are unchanged');
  assert.match(appSource, /World\.setOnDesk\(o => \{\s*if \(typeof TreasurerPortal[\s\S]*?TreasurerPortal\.openFor\(o\.agentId\)\) return;\s*DeskScreen\.open\(o\.agentId\)/);
  assert.match(appSource, /TreasurerPortal\.init\(station\)/);
  const worldSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'app', 'world.js'), 'utf8');
  const stationSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'app', 'stationui.js'), 'utf8');
  for (const name of ['crewTick', 'agHead', 'refreshDossierLive']) {
    const fn = stationSource.match(new RegExp('  function ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?\\n  \\}'));
    assert(fn, name);
    assert.doesNotMatch(fn[0], /officerStatus|GUARDING|ANSWERING/, 'Treasurer uses standard agent activity labels in ' + name);
  }
  const listeners = {};
  const row = {
    dataset: { portalId: portal.avatarId }, hidden: false,
    querySelector: () => null, addEventListener: (name, fn) => { listeners[name] = fn; },
    click: () => listeners.click(),
  };
  const list = {
    innerHTML: '',
    querySelectorAll: selector => selector.includes('data-portal-id') ? [row] : [],
    querySelector: () => row,
  };
  const sum = {}, empty = {}, stage = {};
  const rail = vm.createContext({
    present: [], crewPortals: [], crewQuery: '', runningAgents: new Map(), runSeenAt: new Map(),
    lastStageSummary: '', wireCrewLive() {}, sfx() {}, activity: () => 'idle', esc: String,
    agentLive: () => false, lineTestOnly: () => false,
    $: selector => ({ '#crew': list, '#crew-sum': sum, '#crew-search-empty': empty, '#stage-summary': stage })[selector],
  });
  for (const name of ['duplicateAgentName', 'crewPortrait', 'crewRender', 'setCrewPortals', 'crewTick']) {
    const fn = stationSource.match(new RegExp('  function ' + name + '\\([^\\n]*\\) \\{[\\s\\S]*?\\n  \\}'));
    assert(fn, name);
    vm.runInContext(fn[0], rail);
  }
  rail.entries = [portalLists[0][0]];
  vm.runInContext('setCrewPortals(entries)', rail);
  assert.match(list.innerHTML, /TREASURER/);
  assert.match(list.innerHTML, /PORTAL - FINANCE/);
  assert.doesNotMatch(list.innerHTML, /data-agent-id|DOSSIER|crew-prog/);
  assert.match(sum.innerHTML, /0 WORKING/);
  assert.match(sum.innerHTML, /0 IDLE/);
  assert.match(sum.innerHTML, /1 PORTAL/);
  listeners.click();
  assert.deepEqual(opened.pop(), ['treasurer']);
  let prevented = false;
  listeners.keydown({ key: 'Enter', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(opened.pop(), ['treasurer'], 'keyboard selection opens the portal');
  listeners.contextmenu({ preventDefault() {} });
  assert.deepEqual(opened.pop(), ['treasurer'], 'right-click never opens an agent dossier');
  rail.crewQuery = 'finance';
  vm.runInContext('crewTick()', rail);
  assert.equal(row.hidden, false);
  assert.equal(empty.hidden, true);
  rail.crewQuery = 'engineer';
  vm.runInContext('crewTick()', rail);
  assert.equal(row.hidden, true);
  assert.equal(empty.hidden, false);
  vm.runInContext('setCrewPortals([])', rail);
  assert.doesNotMatch(list.innerHTML, /data-portal-id/);
  const spawn = worldSource.match(/function spawnAgent\(a, opts\) \{[\s\S]*?\n  \}/);
  assert(spawn);
  const spawnContext = vm.createContext({
    agent: { id: 'hero' }, crew: [], geo: {}, DATA: { SKINS: { blank: {} } }, fnow: 0,
    U: { irnd: () => 0 }, deskPropFor: () => ({ id: 'desk' }), deskSeat: () => ({ tx: 7, ty: -13 }),
    seatFoot: () => ({ x: 90, y: 25 }), workerFoot: () => ({ x: 5, y: 5 }),
    makeCrewBody: (id, name, color, x, y) => ({ agentId: id, x, y }), crewColor: () => 'gold',
    greetNewcomer() {},
  });
  vm.runInContext(spawn[0], spawnContext);
  spawnContext.spawnAgent({ id: portal.avatarId }, { atWorkstation: true });
  assert.equal(spawnContext.crew[0].x, 90, 'service avatar starts at its own desk, not the spawn room');
  spawnContext.spawnAgent({ id: 'normal-agent' });
  assert.equal(spawnContext.crew[1].x, 5, 'ordinary agent spawning is unchanged');
  assert.equal(definition[0], 'treasurer');
  const build = definition[2];
  build(body);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.policy.textContent, 'REQUESTED POLICY - NOT YET ENFORCED');
  reply = { ...status, strictFinance };
  elements.refresh.onclick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.policy.textContent, 'STRICT FINANCE ACTIVE - LOCAL ONLY');
  assert.match(body.innerHTML, /America\/Phoenix/);
  assert.match(body.innerHTML, /Treasurer AI adviser has a separate dossier and COMMS/);
  assert.match(elements.summary.textContent, /Trailing 24 hours: \$25.00/);
  assert.deepEqual(requests.filter(url => url !== '/api/finance/strict'), ['/api/budget/status', '/api/budget/status'], 'opening and refreshing controls only read budget status');
  elements.controls.onclick();
  assert.deepEqual(opened.pop(), ['settings', 'budget'], 'controls reuse the real existing editor');
  reply = new Error('offline');
  await elements.refresh.onclick();
  assert.equal(elements.summary.textContent, '', 'failed refresh clears stale totals');
  assert.match(elements.message.textContent, /Finance data unavailable: offline/);
  assert.equal(elements.refresh.disabled, false);
  reply = {};
  await elements.refresh.onclick();
  assert.match(elements.message.textContent, /Invalid finance status/);
  assert.equal(elements.summary.textContent, '');
  body.isConnected = false;
  reply = status;
  await elements.refresh.onclick();
  assert.equal(elements.summary.textContent, '', 'late read cannot repaint a closed window');
  assert.equal(ui.officerStatus(portal.avatarId), 'UNAVAILABLE', 'invalid server telemetry is not shown as guarding');
  assert.equal(ui.officerStatus('chief'), null);
  assert.equal(ui.dossierHTML({ id: 'chief' }), '', 'other dossiers do not get treasury controls');
  assert.match(ui.dossierHTML({ id: portal.avatarId }, true), /data-treasury-record/);
  assert.match(ui.dossierHTML({ id: portal.avatarId }), /data-treasury-live/);
  await assert.rejects(ui.activateAdviser(), /requires the verified local/, 'activation must verify local policy first');
  let created = 0, roster = [], adviserSpec;
  context.App = {
    agents: () => roster,
    summonAgent: (spec, opts) => {
      assert.equal(opts.activate, false, 'creation must not steal the current COMMS');
      adviserSpec = spec;
      created++;
      const a = { id: spec.id, name: 'TREASURER', model: spec.modelPin.model, provider: spec.modelPin.provider, skin: 'blank' };
      roster.push(a);
      return a;
    },
    configSynced: async () => true,
  };
  context.World.setSkin = () => {};
  context.StationUI.openAgent = i => opened.push(['agent', i]);
  reply = { ...strictFinance, enforcement: { state: 'GUARDING', audit: { durable: true, counts: { allowed: 1, blocked: 2 }, recent: [] } } };
  const a = await ui.activateAdviser();
  assert.equal(a.id, portal.avatarId);
  assert.equal(a.provider, 'ollama');
  assert.equal(a.model, 'qwen3.5:4b');
  assert.match(adviserSpec.manual, /cannot authorize payments/);
  assert.match(adviserSpec.manual, /Claude CLI remain blocked/);
  assert.equal(ui.officerStatus(a.id), 'GUARDING');
  const manifest = [{ id: 'agent' }, { id: 'chief' }, { id: 'engineer' }, { id: 'writer' }, a];
  const rooms = { agent: 'home', chief: 'bridge', engineer: 'bridge', writer: 'etsy', [a.id]: 'bridge' };
  context.App.station = () => ({
    props: () => Object.keys(rooms).map(id => ({ agentId: id, t: 'desk', x: id, y: 0 })),
    capForProp: () => 'computer', roomAt: x => rooms[x],
    agentRoomId: () => null,
  });
  const ordered = ui.crewOrder(manifest);
  assert.deepEqual(Array.from(ordered, entry => entry.a.id), ['agent', 'chief', 'engineer', a.id, 'writer'], 'Treasurer joins the Bridge crew above workstation crews');
  assert.deepEqual(Array.from(ordered, entry => entry.i), [0, 1, 2, 4, 3], 'dossier/portrait indices still reference the actual roster');
  assert.equal(manifest[4], a, 'presentation ordering never mutates the runnable roster');
  delete rooms[a.id];
  assert.deepEqual(Array.from(ui.crewOrder(manifest), entry => entry.i), [0, 1, 2, 3, 4], 'an unassigned officer is not falsely grouped into the Bridge');
  await ui.activateAdviser();
  assert.equal(created, 1, 'activation is idempotent');
  changed();
  assert.equal(portalLists.at(-1).length, 0, 'real adviser replaces service entry, not a duplicate');
  assert.equal(spawned.at(-1)[0], a, 'floor sync uses the actual configurable officer skin');
  ui.openFor(a.id);
  assert.deepEqual(opened.pop(), ['agent', 0], 'floor/desk now route to the normal dossier');
  context.App = { agents: () => [] };
  reply = { ...reply, enabled: false, enforcement: { ...reply.enforcement, state: 'DISABLED' } };
  await assert.rejects(ui.activateAdviser(), /requires the verified local/);
  assert.equal(ui.officerStatus(portal.avatarId), 'DISABLED', 'status uses reported server state, independent of adviser existence');
  for (const file of ['index.html', 'agent-station-demo.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'frontend', file), 'utf8');
    assert(html.indexOf('app/windows/treasurer.js') > html.indexOf('app/stationui.js'));
    assert(html.indexOf('app/windows/treasurer.js') < html.indexOf('app/app.js'));
  }
  console.log('treasurer-portal: truthful accounting, error handling, read-only commands, avatar lifecycle and script wiring PASS');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

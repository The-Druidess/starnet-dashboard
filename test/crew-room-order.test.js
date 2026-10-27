'use strict';
const fs = require('node:fs');
const path = require('node:path');
const A = require('./_assert');
const source = fs.readFileSync(path.join(__dirname, '../frontend/app/stationui.js'), 'utf8');
const levels = { 'Tactical Officer': 2, 'Treasurer': 2, 'Chief Engineer': 3 };
const QTerminalStore = {
  authorityFor: agent => ({ level: levels[agent.name] == null ? 4 : levels[agent.name] })
};
const order = Function('QTerminalStore', A.fnBody(source, 'function crewManifestOrder(') + '; return crewManifestOrder;')(QTerminalStore);
const rooms = {
  bridge: { id: 'bridge', name: 'THE BRIDGE', kind: 'bridge' },
  etsy: { id: 'etsy', name: 'ETSY', kind: 'hab' },
  fiverr: { id: 'fiverr', name: 'FIVERR', kind: 'bridge' }
};
const roster = [
  { id: 'z', name: 'Zoologist' }, { id: 'b', name: 'Tactical Officer' },
  { id: 'a', name: 'Chief Engineer' }, { id: 'e', name: 'Accountant' },
  { id: 'f', name: 'Artist' }, { id: 'u', name: 'Adviser' }
];
const props = [
  { agentId: 'z', t: 'pc', x: 'etsy' },
  { agentId: 'b', t: 'pc', x: 'bridge' },
  { agentId: 'a', t: 'pc', x: 'bridge' },
  { agentId: 'f', t: 'pc', x: 'fiverr' }
];
const station = {
  props: () => props, capForProp: t => t === 'pc' ? 'computer' : null,
  roomAt: x => x, roomById: id => rooms[id],
  agentRoomId: id => id === 'e' ? 'etsy' : id === 'a' ? 'fiverr' : null
};
const before = JSON.stringify(roster);
const rows = order(roster, station);
A.eq(rows.map(r => r.a.id), ['b', 'a', 'e', 'z', 'f', 'u'], 'assigned hierarchy levels sort first, then existing Bridge/room order breaks ties');
A.eq(rows.map(r => r.i), [1, 2, 3, 0, 4, 5], 'original dossier indices survive display sorting');
A.eq(rows.map(r => r.roomName), ['THE BRIDGE', 'THE BRIDGE', 'ETSY', 'ETSY', 'FIVERR', 'UNASSIGNED'], 'room labels reflect dedicated computer then bay fallback');
A.eq(rows.map(r => r.authorityLevel), [2, 3, 4, 4, 4, 4], 'assigned levels are retained for rendering and refresh checks');
A.eq(JSON.stringify(roster), before, 'display sorting does not mutate roster');
A.eq(order([{ id: 'portal-treasurer', name: 'Treasurer' }, ...roster], {
  ...station,
  props: () => [...props, { agentId: 'portal-treasurer', t: 'pc', x: 'bridge' }]
}).filter(r => r.roomName === 'THE BRIDGE').map(r => r.a.id), ['b', 'portal-treasurer', 'a'], 'authority level sorts before shared room/title ordering');
rooms.bridge.name = 'Bridge';
A.eq(order(roster, station)[0].a.id, 'b', 'rank order remains primary when the room is renamed');
props[2].x = 'etsy';
A.eq(order(roster, station).map(r => r.a.id), ['b', 'a', 'e', 'z', 'f', 'u'], 'desk moves update assignment and tie-break order');
rooms.etsy.name = 'Workshop';
A.eq(order(roster, station).map(r => r.a.id), ['b', 'a', 'f', 'e', 'z', 'u'], 'room renames update room sorting within each rank');
A.eq(order([{ id: 'b', name: 'alpha' }, { id: 'a', name: 'Alpha' }], null).map(r => r.a.id), ['a', 'b'], 'unlisted agents have deterministic title and ID tie-break');
A.ok(order(roster, null).every(r => r.roomName === 'UNASSIGNED'), 'missing station reports unassigned truthfully');
A.ok(source.includes('<div class="crew-eyebrow" title="'), 'room eyebrow rendered above title');
A.ok(source.includes("row.dataset.roomName || ''"), 'crew search includes room names');
delete rooms.fiverr;
A.eq(order(roster, station).find(r => r.a.id === 'f').roomName, 'UNASSIGNED', 'deleted rooms do not leave stale assignments');
const ul = { innerHTML: '', querySelectorAll: () => [] };
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const render = Function('crewManifestOrder', 'wireCrewLive', '$', 'present', 'crewPortals', 'App', 'esc', 'crewPortrait', 'duplicateAgentName', 'crewTick',
  A.fnBody(source, 'function crewRender(') + '; return crewRender;')(
  order, () => {}, () => ul, roster, [], { station: () => station }, escapeHTML, () => '', () => '', () => {});
rooms.etsy.name = '<Workshop "A">';
render();
A.ok(ul.innerHTML.includes('&lt;Workshop &quot;A&quot;&gt;'), 'room labels and attributes escape HTML');
A.ok(!ul.innerHTML.includes('<Workshop'), 'room names cannot inject markup');
A.ok(ul.innerHTML.indexOf('crew-eyebrow') < ul.innerHTML.indexOf('crew-name'), 'eyebrow precedes crew title');
A.ok(ul.innerHTML.includes('data-authority-level="2"'), 'crew row retains the assigned authority level');
const appSource = fs.readFileSync(path.join(__dirname, '../frontend/app/app.js'), 'utf8');
A.ok(A.fnBody(appSource, 'function watchStationSave(').includes('StationUI.refreshCrewRooms()'), 'model changes refresh room labels/order');
const refreshBody = A.fnBody(source, 'function refreshCrewRooms(');
A.ok(refreshBody.includes('ul.scrollTop = scrollTop') && refreshBody.includes('preventScroll: true'), 'room refresh preserves scroll and keyboard focus');
A.ok(refreshBody.includes('dataset.authorityLevel'), 'hierarchy changes trigger a crew-order refresh');
for (const relative of ['app/stationui.js', 'app/app.js', 'css/style.css']) {
  A.ok(fs.readFileSync(path.join(__dirname, '../frontend', relative)).equals(
    fs.readFileSync(path.join(__dirname, '../website/app', relative))), relative + ' mirror matches');
}
A.report('crew-room-order');

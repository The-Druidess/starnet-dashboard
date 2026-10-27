'use strict';
const fs = require('node:fs');
const path = require('node:path');
const A = require('./_assert');
const source = fs.readFileSync(path.join(__dirname, '../frontend/app/stationui.js'), 'utf8');
const order = Function(A.fnBody(source, 'function crewManifestOrder(') + '; return crewManifestOrder;')();
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
A.eq(rows.map(r => r.a.id), ['a', 'b', 'e', 'z', 'f', 'u'], 'Bridge first, other rooms by name, officer title within room, unassigned last');
A.eq(rows.map(r => r.i), [2, 1, 3, 0, 4, 5], 'original dossier indices survive display sorting');
A.eq(rows.map(r => r.roomName), ['THE BRIDGE', 'THE BRIDGE', 'ETSY', 'ETSY', 'FIVERR', 'UNASSIGNED'], 'room labels reflect dedicated computer then bay fallback');
A.eq(JSON.stringify(roster), before, 'display sorting does not mutate roster');
A.eq(order([{ id: 'portal-treasurer', name: 'Treasurer' }, ...roster], {
  ...station,
  props: () => [...props, { agentId: 'portal-treasurer', t: 'pc', x: 'bridge' }]
}).filter(r => r.roomName === 'THE BRIDGE').map(r => r.a.id), ['a', 'b', 'portal-treasurer'], 'Treasurer uses the shared room/title ordering without a workflow bay');
rooms.bridge.name = 'Bridge';
A.eq(order(roster, station)[0].a.id, 'a', 'Bridge without article also leads');
props[2].x = 'etsy';
A.eq(order(roster, station).map(r => r.a.id), ['b', 'e', 'a', 'z', 'f', 'u'], 'desk moves update assignment and order');
rooms.etsy.name = 'Workshop';
A.eq(order(roster, station).map(r => r.a.id), ['b', 'f', 'e', 'a', 'z', 'u'], 'room renames update room sorting');
A.eq(order([{ id: 'b', name: 'alpha' }, { id: 'a', name: 'Alpha' }], null).map(r => r.a.id), ['a', 'b'], 'case-insensitive titles have deterministic ID tie-break');
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
const appSource = fs.readFileSync(path.join(__dirname, '../frontend/app/app.js'), 'utf8');
A.ok(A.fnBody(appSource, 'function watchStationSave(').includes('StationUI.refreshCrewRooms()'), 'model changes refresh room labels/order');
const refreshBody = A.fnBody(source, 'function refreshCrewRooms(');
A.ok(refreshBody.includes('ul.scrollTop = scrollTop') && refreshBody.includes('preventScroll: true'), 'room refresh preserves scroll and keyboard focus');
for (const relative of ['app/stationui.js', 'app/app.js', 'css/style.css']) {
  A.ok(fs.readFileSync(path.join(__dirname, '../frontend', relative)).equals(
    fs.readFileSync(path.join(__dirname, '../website/app', relative))), relative + ' mirror matches');
}
A.report('crew-room-order');

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const A = require('./_assert');
const source = fs.readFileSync(path.join(__dirname, '../frontend/app/stationui.js'), 'utf8');
const levels = { 'Tactical Officer': 2, 'Treasurer': 2, 'Chief Engineer': 3 };
const QTerminalStore = {
  authorityFor: agent => ({ level: Object.prototype.hasOwnProperty.call(levels, agent.name) ? levels[agent.name] : null })
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
A.eq(rows.map(r => r.authorityLevel), [2, 3, null, null, null, null], 'unlisted agents receive no assigned hierarchy level');
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
const qEvents = {};
const qRow = { addEventListener: (type, handler) => { qEvents[type] = handler; } };
const ul = {
  innerHTML: '',
  querySelectorAll: selector => selector === '.crew-row[data-q-terminal]' ? [qRow] : []
};
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const openedTerms = [];
const render = Function('crewManifestOrder', 'wireCrewLive', '$', 'present', 'crewPortals', 'App', 'esc', 'crewPortrait', 'duplicateAgentName', 'crewTick', 'openTerm', 'sfx',
  A.fnBody(source, 'function crewRender(') + '; return crewRender;')(
  order, () => {}, () => ul, roster, [], { station: () => station }, escapeHTML, () => '', () => '', () => {}, name => openedTerms.push(name), () => {});
rooms.etsy.name = '<Workshop "A">';
render();
A.ok(ul.innerHTML.startsWith('<li class="crew-row crew-q-row"'), 'Q is the first roster entry ahead of all agent levels');
A.ok(ul.innerHTML.includes('data-q-terminal data-authority-level="0"'), 'Q is listed as the human Level 0 Captain without an agent ID');
A.eq((ul.innerHTML.match(/<li class="crew-row/g) || []).length, roster.length + 1, 'Q is one visible crew-list row in addition to the current agents');
A.ok(typeof qEvents.click === 'function', 'Q crew entry has a click handler');
qEvents.click();
A.eq(openedTerms, ['q'], 'selecting Q opens the Q communications terminal');
let prevented = false;
qEvents.keydown({ key: 'Enter', preventDefault: () => { prevented = true; } });
A.ok(prevented, 'keyboard selection prevents the default action');
A.eq(openedTerms, ['q', 'q'], 'keyboard activation opens the Q communications terminal');
A.ok(ul.innerHTML.includes('&lt;Workshop &quot;A&quot;&gt;'), 'room labels and attributes escape HTML');
A.ok(!ul.innerHTML.includes('<Workshop'), 'room names cannot inject markup');
A.ok(ul.innerHTML.indexOf('crew-eyebrow') < ul.innerHTML.indexOf('crew-name'), 'eyebrow precedes crew title');
A.ok(ul.innerHTML.includes('data-authority-level="2"'), 'crew row retains the assigned authority level');
A.ok(ul.innerHTML.includes('class="crew-room" title="Assigned hierarchy level">Level 2</span>'), 'crew row visibly labels the authority rank, not game XP');
A.ok(!ul.innerHTML.includes('title="Assigned hierarchy level">Level null'), 'unlisted crew receives no visible level indicator');
const unlistedRow = /<li class="crew-row"[^>]*data-agent-id="e"[\s\S]*?<\/li>/.exec(ul.innerHTML);
A.ok(unlistedRow && !unlistedRow[0].includes('crew-room'), 'unlisted agents have no level indicator in their own row');
roster.splice(0, roster.length,
  { id: 'commander', name: 'Jean-Luc Picard' },
  { id: 'first-officer', name: 'Data (as Sherlock)' },
  { id: 'chief-ops', name: 'Chief Ops Officer' },
  { id: 'chief-security', name: 'Worf' },
  { id: 'chief-comm', name: 'Seven of Nine' },
  { id: 'chief-med', name: 'Beverly Crusher' },
  { id: 'chief-science', name: 'Geordi LaForge' },
  { id: 'chief-helm', name: 'Tom Paris' },
  { id: 'chief-engineer', name: 'Scotty' },
  { id: 'ambassador', name: 'Deanna Troi' },
  { id: 'treasurer', name: 'Quark' }
);
render();
A.eq((ul.innerHTML.match(/<li class="crew-row/g) || []).length, 12, 'Q plus eleven Bridge agents are represented by twelve crew-list entries');
roster.splice(0);
render();
A.eq((ul.innerHTML.match(/<li class="crew-row/g) || []).length, 1, 'Q remains selectable when no AI agents are on station');
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

'use strict';
const assert = require('assert');

const saved = new Map();
saved.set('starnet.q-terminal.v1', JSON.stringify({ directive: '' }));
global.localStorage = {
  getItem: key => saved.has(key) ? saved.get(key) : null,
  setItem: (key, value) => saved.set(key, value)
};
const Q = require('../frontend/app/qterminal.js');

const defaultDirective = Q.directive();
assert.match(defaultDirective, /The USS Theseus/);
assert.match(defaultDirective, /\$1,000,000,000/);
assert.match(defaultDirective, /Human authorization is required/);
assert.ok(defaultDirective.length <= 8000, 'the default fits the saved directive limit');
assert.match(Q.promptClause(), /PRIME DIRECTIVE — PROJECT-WIDE OPERATING RULES:[\s\S]*The USS Theseus/);
const defaultHierarchy = [
  'The Captain (Q; aka me) - Level 0',
  'The Commander – Level 1',
  'The First Officer – Level 2',
  'Chief Ops Officer – Level 3',
  'Chief Security Officer – Level 2',
  'Chief Comm Officer – Level 3',
  'Chief Med Officer – Level 3',
  'Chief Science Officer – Level 3',
  'Chief Helm Officer – Level 3',
  'Chief Engineer – Level 3',
  'The Ambassador – Level 3',
  'The Treasurer – Level 2'
].join('\n');
assert.strictEqual(Q.hierarchy(), defaultHierarchy);
assert.deepStrictEqual(Q.authorityFor({ id: 'agent', name: 'COMMANDER' }), {
  level: 1, listed: true, role: 'The Commander', hierarchy: defaultHierarchy
});
const bridgeLevels = [
  ['Jean-Luc Picard', 1],
  ['First Officer', 2],
  ['Chief Security Officer', 2],
  ['Chief Ops Officer', 3],
  ['Chief Comm Officer', 3],
  ['Chief Med Officer', 3],
  ['Chief Science Officer', 3],
  ['Chief Helm Officer', 3],
  ['Chief Engineer', 3],
  ['The Ambassador', 3],
  ['The Treasurer', 2],
  ['Data (as Sherlock)', 2],
  ['Worf', 2],
  ['Quark', 2],
  ['Scotty', 3],
  ['Seven of Nine', 3],
  ['Deanna Troi', 3],
  ['Tom Paris', 3],
  ['Beverly Crusher', 3],
  ['Geordi LaForge', 3]
];
for (const [name, level] of bridgeLevels) {
  assert.strictEqual(Q.authorityFor({ id: name.toLowerCase().replace(/\W+/g, '-'), name }).level, level, name + ' has its assigned Bridge hierarchy level');
}
const assignments = [
  ['Scotty', 'Chief Engineer', 3],
  ['Seven of Nine', 'Chief Comm Officer', 3],
  ['Deanna Troi', 'The Ambassador', 3],
  ['Tom Paris', 'Chief Helm Officer', 3],
  ['Beverly Crusher', 'Chief Med Officer', 3],
  ['Data (as Sherlock)', 'The First Officer', 2],
  ['Geordi LaForge', 'Chief Science Officer', 3],
  ['Worf', 'Chief Security Officer', 2],
  ['Quark', 'The Treasurer', 2]
];
for (const [name, role, level] of assignments) {
  const authority = Q.authorityFor({ id: name.toLowerCase().replace(/\W+/g, '-'), name });
  assert.deepStrictEqual([authority.role, authority.level, authority.listed], [role, level, true], name + ' resolves to assigned Bridge role');
}
assert.strictEqual(Q.authorityFor({ id: 'bridge-commander', name: 'Jean-Luc Picard' }).listed, true, 'Jean-Luc resolves to the Commander role');
assert.strictEqual(Q.authorityFor({ id: 'human', name: 'The Captain (Q; aka me)' }).level, 0, 'Captain/Q alias resolves to Level 0');
assert.strictEqual(Q.parseHierarchy(defaultHierarchy).entries.length, 12, 'Q reference includes all eleven Bridge posts and the human Captain');
assert.strictEqual(Q.authorityFor({ id: 'chief', name: 'FIRST OFFICER' }).level, 2, 'Number Two remains compatible with the First Officer role');
assert.match(Q.roleDirective('Number Two'), /FIRST OFFICER \(NUMBER TWO\) — LEVEL 2/);
assert.match(Q.roleDirective('First Officer'), /halt that operation and wait for human intervention/);
assert.strictEqual(Q.authorityFor({ id: 'bridge-tactical', name: 'TACTICAL OFFICER' }).level, 2);
assert.strictEqual(Q.authorityFor({ id: 'new-agent', name: 'New Agent' }).level, null, 'non-Bridge crew has no assigned hierarchy level');
assert.strictEqual(Q.authorityFor({ id: 'new-agent', name: 'New Agent' }).listed, false);
assert.strictEqual(Q.parseHierarchy(defaultHierarchy).ok, true);
assert.strictEqual(Q.parseHierarchy(defaultHierarchy.replace('The Captain (Q; aka me) - Level 0', 'The Commander – Level 0')).ok, false);
assert.strictEqual(Q.parseHierarchy(defaultHierarchy + '\nQ — Level 0').ok, false);
assert.strictEqual(Q.parseHierarchy(defaultHierarchy + '\nTactical Officer — Level 2').ok, false, 'role aliases cannot receive conflicting rank entries');
let promptRefreshes = 0;
global.App = { persist: () => true, refreshAgentPrompts: () => { promptRefreshes++; return true; } };
assert.strictEqual(Q.setDirective('Protect the crew and keep the station operational.').ok, true);
assert.strictEqual(Q.directive(), 'Protect the crew and keep the station operational.');
assert.strictEqual(promptRefreshes, 1, 'saving the Prime Directive refreshes current agent prompts');
assert.deepStrictEqual(Q.setDirective('   '), { ok: false, error: 'The Prime Directive cannot be empty.' });
assert.strictEqual(Q.directive(), 'Protect the crew and keep the station operational.', 'an empty update does not remove the saved directive');
assert.strictEqual(Q.setQDirective('A human operating commitment.').ok, false, 'programmatic calls cannot authorize Q directive changes');
assert.strictEqual(Q.qDirective(), '', 'rejected Q directive updates leave the store unchanged');
assert.strictEqual(Q.setHierarchy(defaultHierarchy).ok, false, 'programmatic calls cannot authorize hierarchy changes');
assert.strictEqual(Q.setHierarchy(defaultHierarchy, new Event('click')).ok, false, 'untrusted events cannot authorize hierarchy changes');
assert.strictEqual(Q.hierarchy(), defaultHierarchy, 'rejected hierarchy changes leave the roster intact');
assert.strictEqual(Q.setHierarchy('   ').ok, false, 'an empty hierarchy cannot erase the reference roster');
assert.strictEqual(promptRefreshes, 1, 'rejected hierarchy changes do not refresh agent prompts');
assert.strictEqual(Q.setRoleDirective('commander', 'A commander directive.').ok, false, 'programmatic calls cannot authorize role directives');
assert.strictEqual(Q.roleDirective('commander'), '', 'rejected role directive updates leave the store unchanged');
assert.match(Q.promptClause({ id: 'agent', name: 'COMMANDER' }), /YOUR ROSTER ASSIGNMENT: The Commander — Level 1 \(listed\)/);
assert.match(Q.promptClause({ id: 'chief', name: 'FIRST OFFICER' }), /YOUR ROLE-SPECIFIC DIRECTIVE — THE FIRST OFFICER:[\s\S]*FIRST OFFICER \(NUMBER TWO\) — LEVEL 2/);
assert.match(Q.promptClause({ id: 'new-agent', name: 'New Agent' }), /YOUR ROSTER ASSIGNMENT: New Agent — unlisted \(below all listed roles; no assigned level\)/);
assert.match(Q.promptClause(), /Only Q \(Level 0, the human Commander\) may alter the hierarchy/);
delete global.App;
assert.match(Q.promptClause(), /PRIME DIRECTIVE — PROJECT-WIDE OPERATING RULES:[\s\S]*Protect the crew and keep the station operational\./);
assert.match(Q.promptClause(), /BRIDGE CREW HIERARCHY ROSTER \(Q REFERENCE\):[\s\S]*Chief Security Officer – Level 2/);
assert.strictEqual(Q.saveCommand('', 'status report', 'All systems nominal.').ok, true);
assert.strictEqual(Q.saveCommand('', 'status report', 'Duplicate.').ok, false);
assert.strictEqual(Q.saveCommand('', 'Status report', 'Case-sensitive command.').ok, true);

const input = [
  'I finished the report.',
  'Q_MESSAGE: The inventory is ready.',
  'Q_QUESTION: Should I send it now?',
  'Q_COMMAND: status report',
  'Q_COMMAND: STATUS REPORT',
  'Q_DIRECTIVE_REQUEST',
  'Q_HUMAN_DIRECTIVE_REQUEST',
  'Q_HIERARCHY_REQUEST',
  'Q_COORDINATION_REQUEST'
].join('\n');
const captured = Q.capture(input, 'engineer', 'workstream-1', 'run-1');
assert.strictEqual(captured.text, 'I finished the report.\nQ has no saved human operating directive.\nQ · BRIDGE CREW HIERARCHY ROSTER:\n' + defaultHierarchy + '\nQ · BRIDGE CREW COORDINATION AND ESCALATION GUIDE:\n' + [
  'BRIDGE AUTHORITY AND COORDINATION',
  'Q is the human Commander at Level 0 and is the only authority that may alter the Bridge Crew Hierarchy Roster. Agents may request and read the roster but must not edit it, replace it, assign themselves roles, or treat rank as permission. Number Two (First Officer) is Level 2 and coordinates Bridge work within authority delegated by Q; escalate unresolved conflicts, unclear authority, and reserved decisions to Q.',
  '',
  'REPORTING ROUTES',
  '- Commander-related issues: Q directly.',
  '- Treasury, security, and communications issues: Q directly, plus the responsible assigned Bridge specialist for departmental handling. Halt affected operations that cannot be repaired within authorized scope and await human intervention.',
  '- Extensive agent troubleshooting: Chief Medical Officer for diagnosis and repair coordination. Only an authorized agent with necessary access may perform repairs.',
  '- Communications repairs or training: Chief Communications Officer.',
  '- Technical infrastructure, integrations, and system support: Chief Engineer.',
  '- Workload, resources, dependencies, throughput, and operational status: Chief Ops Officer; unresolved issues, unavailable assignment, or unclear authority go to Q.',
  '- Finances, budgets, expenditures, revenue, and financial obligations: Treasurer and Q directly.',
  '- Security rules, access restrictions, authorization boundaries, or threats to ship systems, information, assets, and operational integrity: Q directly and the assigned security specialist. Never bypass a restriction to investigate or repair.',
  '',
  'Do not modify the roster to satisfy a routing request. If no responsible officer is listed or available, refer the issue to Q. Record routine issues for tracking; report major errors and failures to Q. Agents must pause disputed or human-reserved operations until Q resolves or authorizes resumption. This guide conveys reporting guidance only; it grants no access, tools, approval, or authority.'
].join('\n'));
assert.deepStrictEqual(captured.received.map(row => row.kind), ['message', 'question', 'command', 'command', 'directive']);
assert.strictEqual(captured.received[2].matchedResponse, 'All systems nominal.');
assert.strictEqual(captured.received[3].matchedResponse, '');
assert.strictEqual(Q.hierarchy(), defaultHierarchy, 'the read-only coordination response cannot change the roster');
assert.strictEqual(Q.capture(input, 'engineer', 'workstream-1', 'run-1').received.length, 0, 'same run markers are idempotent');
assert.strictEqual(Q.stripMarkers('visible\nQ_MESSAGE: hidden\nQ_HIERARCHY_REQUEST\nmore visible'), 'visible\nmore visible');
assert.strictEqual(Q.stripMarkers('visible\nQ_ROLE_DIRECTIVE_REQUEST: Commander\nmore visible'), 'visible\nmore visible');
assert.strictEqual(Q.stripMarkers('visible\nQ_HUMAN_DIRECTIVE_REQUEST\nmore visible'), 'visible\nmore visible');
assert.strictEqual(Q.stripMarkers('visible\nQ_COORDINATION_REQUEST\nmore visible'), 'visible\nmore visible');
assert.match(Q.promptClause(), /Q_DIRECTIVE_REQUEST/);
assert.match(Q.promptClause(), /Q_HUMAN_DIRECTIVE_REQUEST/);
assert.match(Q.promptClause(), /Q_HIERARCHY_REQUEST/);
assert.match(Q.promptClause(), /Q_COORDINATION_REQUEST/);

const question = Q.messages().find(row => row.kind === 'question');
assert.ok(question);
assert.strictEqual(Q.markReplied(question.id, 'Send it now.').ok, true);
assert.strictEqual(Q.messages().find(row => row.id === question.id).status, 'replied');
assert.strictEqual(Q.messages().find(row => row.id === question.id).response, 'Send it now.');
const note = Q.messages().find(row => row.kind === 'message');
assert.strictEqual(Q.markReplied(note.id, 'Queued note.', 'queued').ok, true);
assert.strictEqual(Q.messages().find(row => row.id === note.id).status, 'queued');

delete require.cache[require.resolve('../frontend/app/qterminal.js')];
const reloaded = require('../frontend/app/qterminal.js');
assert.strictEqual(reloaded.directive(), 'Protect the crew and keep the station operational.');
assert.strictEqual(reloaded.messages().length, 5, 'inbox records persist across module reloads');
assert.strictEqual(reloaded.messages().find(row => row.id === note.id).status, 'queued');
assert.strictEqual(reloaded.commands().length, 2);
assert.strictEqual(reloaded.hierarchy(), defaultHierarchy, 'the hierarchy roster persists across module reloads');
const snapshot = reloaded.serialize();
assert.strictEqual(snapshot.commands.length, 2);
assert.strictEqual(reloaded.hydrate({ directive: 'Restored directive.', commands: [], messages: [] }), true);
assert.strictEqual(reloaded.directive(), 'Restored directive.');
assert.strictEqual(reloaded.hierarchy(), defaultHierarchy, 'older saved Q state receives the default hierarchy');
assert.strictEqual(reloaded.hydrate({ directive: 'Restored directive.', hierarchy: defaultHierarchy.replace('The Captain (Q; aka me) - Level 0', 'The Commander – Level 0') }), true);
assert.strictEqual(reloaded.hierarchy(), defaultHierarchy, 'invalid persisted rosters are replaced with the valid default');
const legacyHierarchy = [
  'Q — Level 0',
  'The Commander — Level 1',
  'The First Officer — Level 2',
  'Chief Ops Officer — Level 3',
  'Chief Security Officer — Level 2',
  'Chief Comm Officer — Level 3',
  'Chief Med Officer — Level 3',
  'Chief Science Officer — Level 3',
  'Chief Helm Officer — Level 3',
  'Chief Engineer — Level 3',
  'The Ambassador — Level 3',
  'The Treasurer — Level 2'
].join('\n');
assert.strictEqual(reloaded.hydrate({ directive: 'Restored directive.', hierarchy: legacyHierarchy }), true);
assert.strictEqual(reloaded.hierarchy(), defaultHierarchy, 'the shipped legacy roster migrates to the Commander-provided hierarchy');
const previousTheseusHierarchy = [
  'Q — Level 0',
  'The Commander — Level 1',
  'Number Two — Level 2',
  'Chief Engineer — Level 3',
  'Comms Officer — Level 3',
  'Embassador — Level 3',
  'Helm Officer — Level 3',
  'Med Officer — Level 3',
  'Sci Officer — Level 3',
  'Tactical Officer — Level 2',
  'The Treasurer — Level 2'
].join('\n');
assert.strictEqual(reloaded.hydrate({ directive: 'Restored directive.', hierarchy: previousTheseusHierarchy }), true);
assert.strictEqual(reloaded.hierarchy(), defaultHierarchy, 'the previously shipped Theseus default migrates to the current hierarchy');
const levelFourChiefOpsHierarchy = defaultHierarchy.replace('Chief Ops Officer – Level 3', 'Chief Ops Officer – Level 4');
assert.strictEqual(reloaded.hydrate({ directive: 'Restored directive.', hierarchy: levelFourChiefOpsHierarchy }), true);
assert.strictEqual(reloaded.authorityFor({ id: 'chief-ops', name: 'Chief Ops Officer' }).level, 3,
  'an existing Chief Ops assignment at Level 4 is corrected to Level 3');
assert.ok(reloaded.hierarchy().includes('Chief Ops Officer – Level 3'), 'the corrected Chief Ops level is reflected in the roster');
assert.strictEqual(reloaded.hydrate({ directive: 'Restored directive.', hierarchy: defaultHierarchy }), true);
const commanderDirective = 'Commander role directive fixture.';
assert.strictEqual(reloaded.hydrate({
  directive: 'Restored directive.',
  qDirective: 'Q will lead predictably and fairly.',
  hierarchy: defaultHierarchy,
  roleDirectives: { commander: commanderDirective }
}), true);
assert.strictEqual(reloaded.qDirective(), 'Q will lead predictably and fairly.');
assert.strictEqual(reloaded.roleDirective('The Commander'), commanderDirective);
assert.match(reloaded.promptClause(), /Q’S HUMAN OPERATING DIRECTIVE:[\s\S]*Q will lead predictably and fairly\./);
assert.match(reloaded.promptClause({ id: 'agent', name: 'COMMANDER' }), /YOUR ROLE-SPECIFIC DIRECTIVE — THE COMMANDER:[\s\S]*Commander role directive fixture\./);
global.App = { agents: () => [{ id: 'agent', name: 'COMMANDER' }] };
const qDirectiveReply = reloaded.capture('Q_HUMAN_DIRECTIVE_REQUEST', 'agent', 'workstream-1', 'run-4');
assert.strictEqual(qDirectiveReply.text, 'Q · HUMAN OPERATING DIRECTIVE:\nQ will lead predictably and fairly.');
const roleReply = reloaded.capture('Q_ROLE_DIRECTIVE_REQUEST', 'agent', 'workstream-1', 'run-2');
assert.strictEqual(roleReply.text, 'Q · DIRECTIVE FOR THE COMMANDER:\n' + commanderDirective);
const otherRoleReply = reloaded.capture('Q_ROLE_DIRECTIVE_REQUEST: First Officer', 'agent', 'workstream-1', 'run-3');
assert.strictEqual(otherRoleReply.text, 'Q · DIRECTIVE FOR FIRST OFFICER:\n' + reloaded.roleDirective('First Officer'));
assert.strictEqual(reloaded.hydrate({ directive: 'Restored directive.', hierarchy: defaultHierarchy, roleDirectives: { 'OVERLORD': 'Old title should not be recognized.' } }), true);
assert.strictEqual(reloaded.roleDirective('commander'), '', 'role directives do not retain the retired Overlord title as an alias');
delete global.App;
assert.match(reloaded.promptClause(), /Restored directive\./, 'saved Prime Directive is available in every composed agent prompt');
assert.strictEqual(reloaded.messages().length, 0);

console.log('Q terminal: exact command matching, local persistence, marker capture, deduplication, and replies passed.');

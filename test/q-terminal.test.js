'use strict';
const assert = require('assert');

const saved = new Map();
global.localStorage = {
  getItem: key => saved.has(key) ? saved.get(key) : null,
  setItem: (key, value) => saved.set(key, value)
};
const Q = require('../frontend/app/qterminal.js');

assert.doesNotMatch(Q.promptClause(), /PRIME DIRECTIVE — PROJECT-WIDE OPERATING RULES:/, 'an empty directive is not inserted into prompts');
const defaultHierarchy = [
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
assert.strictEqual(Q.hierarchy(), defaultHierarchy);
assert.deepStrictEqual(Q.authorityFor({ id: 'agent', name: 'COMMANDER' }), {
  level: 1, listed: true, role: 'The Commander', hierarchy: defaultHierarchy
});
assert.strictEqual(Q.authorityFor({ id: 'chief', name: 'FIRST OFFICER' }).level, 2);
assert.strictEqual(Q.authorityFor({ id: 'bridge-tactical', name: 'TACTICAL OFFICER' }).level, 2);
assert.strictEqual(Q.authorityFor({ id: 'new-agent', name: 'New Agent' }).level, 4);
assert.strictEqual(Q.authorityFor({ id: 'new-agent', name: 'New Agent' }).listed, false);
assert.strictEqual(Q.parseHierarchy(defaultHierarchy).ok, true);
assert.strictEqual(Q.parseHierarchy(defaultHierarchy.replace('Q — Level 0', 'The Commander — Level 0')).ok, false);
assert.strictEqual(Q.parseHierarchy(defaultHierarchy + '\nAnother Q — Level 0').ok, false);
assert.strictEqual(Q.parseHierarchy(defaultHierarchy + '\nTactical Officer — Level 2').ok, false, 'role aliases cannot receive conflicting rank entries');
let promptRefreshes = 0;
global.App = { persist: () => true, refreshAgentPrompts: () => { promptRefreshes++; return true; } };
assert.strictEqual(Q.setDirective('Protect the crew and keep the station operational.').ok, true);
assert.strictEqual(Q.directive(), 'Protect the crew and keep the station operational.');
assert.strictEqual(promptRefreshes, 1, 'saving the Prime Directive refreshes current agent prompts');
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
assert.match(Q.promptClause({ id: 'new-agent', name: 'New Agent' }), /YOUR ROSTER ASSIGNMENT: New Agent — Level 4 \(unlisted; subordinate to all listed roles\)/);
assert.match(Q.promptClause(), /Only Q \(Level 0, the human Commander\) may alter the hierarchy/);
delete global.App;
assert.match(Q.promptClause(), /PRIME DIRECTIVE — PROJECT-WIDE OPERATING RULES:[\s\S]*Protect the crew and keep the station operational\./);
assert.match(Q.promptClause(), /BRIDGE CREW HIERARCHY ROSTER \(Q REFERENCE\):[\s\S]*Chief Security Officer — Level 2/);
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
  'Q_HIERARCHY_REQUEST'
].join('\n');
const captured = Q.capture(input, 'engineer', 'workstream-1', 'run-1');
assert.strictEqual(captured.text, 'I finished the report.\nQ has no saved human operating directive.\nQ · BRIDGE CREW HIERARCHY ROSTER:\n' + defaultHierarchy);
assert.deepStrictEqual(captured.received.map(row => row.kind), ['message', 'question', 'command', 'command', 'directive']);
assert.strictEqual(captured.received[2].matchedResponse, 'All systems nominal.');
assert.strictEqual(captured.received[3].matchedResponse, '');
assert.strictEqual(Q.capture(input, 'engineer', 'workstream-1', 'run-1').received.length, 0, 'same run markers are idempotent');
assert.strictEqual(Q.stripMarkers('visible\nQ_MESSAGE: hidden\nQ_HIERARCHY_REQUEST\nmore visible'), 'visible\nmore visible');
assert.strictEqual(Q.stripMarkers('visible\nQ_ROLE_DIRECTIVE_REQUEST: Commander\nmore visible'), 'visible\nmore visible');
assert.strictEqual(Q.stripMarkers('visible\nQ_HUMAN_DIRECTIVE_REQUEST\nmore visible'), 'visible\nmore visible');
assert.match(Q.promptClause(), /Q_DIRECTIVE_REQUEST/);
assert.match(Q.promptClause(), /Q_HUMAN_DIRECTIVE_REQUEST/);
assert.match(Q.promptClause(), /Q_HIERARCHY_REQUEST/);

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
assert.strictEqual(reloaded.hydrate({ directive: 'Restored directive.', hierarchy: defaultHierarchy.replace('Q — Level 0', 'The Commander — Level 0') }), true);
assert.strictEqual(reloaded.hierarchy(), defaultHierarchy, 'invalid persisted rosters are replaced with the valid default');
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
assert.strictEqual(otherRoleReply.text, 'Q has no saved role directive for First Officer.');
assert.strictEqual(reloaded.hydrate({ directive: 'Restored directive.', hierarchy: defaultHierarchy, roleDirectives: { 'OVERLORD': 'Old title should not be recognized.' } }), true);
assert.strictEqual(reloaded.roleDirective('commander'), '', 'role directives do not retain the retired Overlord title as an alias');
delete global.App;
assert.match(reloaded.promptClause(), /Restored directive\./, 'saved Prime Directive is available in every composed agent prompt');
assert.strictEqual(reloaded.messages().length, 0);

console.log('Q terminal: exact command matching, local persistence, marker capture, deduplication, and replies passed.');

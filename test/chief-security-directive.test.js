'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../frontend/app/app.js'), 'utf8');
const qterminal = require('../frontend/app/qterminal.js');

const directive = app.match(/  const DEFAULT_CHIEF_SECURITY_MANUAL = \[[\s\S]*?\n  \]\.join\('\\n'\);/);
const resolver = app.match(/  function isChiefSecurityAgent\(a\) \{[\s\S]*?\n  \}/);
const docs = app.match(/  function agentDocs\(a\) \{[\s\S]*?\n  \}/);
assert.ok(directive && resolver && docs, 'Chief Security Officer manual is attached through agent docs configuration');
const qAuthority = qterminal;
const agentDocs = new Function('QTerminalStore', 'baseIdentity',
  directive[0] + '\n' + resolver[0] + '\n' + docs[0] + '\nreturn agentDocs;')(qAuthority, name => 'IDENTITY: ' + name);

const securityAgent = { id: 'worf', name: 'Worf', role: 'specialist' };
const securityDocs = agentDocs(securityAgent);
assert.match(securityDocs.manual, /CHIEF SECURITY OFFICER — LEVEL 2/);
for (const route of [
  /Security or legal risk:[\s\S]*report directly to Q and the responsible security authority/,
  /Directive conflict[\s\S]*report to the Chief Ops Officer/,
  /Financial risk[\s\S]*report to the Treasurer/,
  /Critical failure[\s\S]*report to the Chief Science Officer/,
  /Unverified critical information[\s\S]*report to the Chief Engineer/,
  /Repeated failure[\s\S]*fails twice consecutively[\s\S]*report to the Chief Communications Officer/,
  /Unauthorized action[\s\S]*report to the First Officer/,
  /Human authorization required[\s\S]*report to Q/
]) assert.match(securityDocs.manual, route, 'agent operating manual includes each requested escalation route');
assert.match(securityDocs.manual, /Do not claim to enforce a stop outside your available authority or tools/);
assert.match(app, /STANDING ORDERS \(operating-manual\.md\)[\s\S]{0,80}\+ manual/,
  'the directive is composed from the Chief Security Officer’s own operating manual');
assert.match(app, /docs: a\.docs/,
  'the security directive persists as part of the agent’s saved configuration');

const otherAgent = { id: 'other', name: 'Unlisted Agent', role: 'specialist' };
assert.strictEqual(agentDocs(otherAgent).manual, '', 'the security directive is not attached to unrelated agents');
const customized = { id: 'worf-custom', name: 'Worf', role: 'specialist', docs: { manual: 'Commander-authored security orders.' } };
assert.strictEqual(agentDocs(customized).manual, 'Commander-authored security orders.',
  'existing agent-authored manual content is preserved');

assert.strictEqual(qAuthority.roleDirective('Chief Security Officer'), '',
  'the directive is absent from Q’s role-directive storage');
console.log('chief-security-directive.test: direct agent configuration and escalation routes passed.');

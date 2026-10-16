'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { makeWorkspaceOwner, makeBootedAt } = require('../sidecar/workspace-owner.js');
const { writeFileDurable } = require('../sidecar/durable-write.js');
const { validateConfig, POLICY } = require('../sidecar/strict-finance.js');

function enable(workspace, localModels) {
  if (!workspace || !path.isAbsolute(workspace)) throw new Error('An explicit absolute workspace path is required.');
  if (!fs.statSync(workspace).isDirectory()) throw new Error('Workspace is not a directory.');
  const config = validateConfig({ ...POLICY, version: 1, enabled: true, mode: 'local-only', localModels });
  const owner = makeWorkspaceOwner({ fs, path, now: () => Date.now(), bootedAt: makeBootedAt(() => Date.now()) });
  const claim = owner.acquire(workspace);
  if (!claim.ok) throw new Error('Stop the sidecar before enabling strict finance; workspace ownership is busy.');
  try {
    const file = path.join(workspace, 'strict-finance.json');
    writeFileDurable({ fs, path }, file, JSON.stringify(config, null, 2) + '\n');
    if (JSON.stringify(validateConfig(JSON.parse(fs.readFileSync(file, 'utf8')))) !== JSON.stringify(config)) {
      throw new Error('Strict finance policy read-back did not match.');
    }
    return config;
  } finally { owner.release(); }
}
if (require.main === module) {
  try {
    const [workspace, ...models] = process.argv.slice(2);
    const config = enable(workspace, models);
    console.log(JSON.stringify({ saved: true, ...config, next: 'Restart Starnet. Paid/unverified work is blocked; only named local Ollama inference and approved local reads remain.' }));
  } catch (error) {
    console.error('Could not enable strict finance: ' + error.message);
    process.exitCode = 1;
  }
}
module.exports = { enable };

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workflowPath = path.join(__dirname, '../.github/workflows/update.yml');
function workflow() { assert.ok(fs.existsSync(workflowPath), 'update workflow must exist'); return fs.readFileSync(workflowPath, 'utf8').replace(/\r\n/g, '\n'); }

test('update trigger allows code pushes but excludes automated data commits', () => {
  const yaml = workflow();
  assert.match(yaml, /workflow_dispatch:/);
  assert.match(yaml, /cron: '0 \*\/4 \* \* \*'/);
  const push = yaml.match(/  push:\n([\s\S]*?)^permissions:/m)?.[1];
  assert.ok(push, 'push path filter must exist');
  for (const item of ['.github/workflows/update.yml', 'lib/**', 'scripts/**', 'site/**', 'test/**', 'package.json']) assert.ok(push.includes(`'${item}'`), item);
  assert.ok(!push.includes('data/'), 'data-only commits must not retrigger update');
  assert.match(yaml, /branches: \[main\]/);
});

test('single serialized update validates and builds before committing or publishing', () => {
  const yaml = workflow();
  for (const permission of ['contents: write', 'pages: write', 'id-token: write']) assert.ok(yaml.includes(permission));
  assert.match(yaml, /concurrency:\n  group: dlt-update-and-pages\n  cancel-in-progress: false/);
  assert.match(yaml, /node-version: '20'/);
  assert.match(yaml, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  const ordered = ['node --test test/*.test.js', 'node scripts/update.js', 'node scripts/build.js', 'git add -- data/*.json', 'git push', 'actions/configure-pages@v5', 'actions/upload-pages-artifact@v4', 'actions/deploy-pages@v4'];
  let previous = -1;
  for (const command of ordered) { const position = yaml.indexOf(command); assert.ok(position > previous, `${command} must follow prior gate`); previous = position; }
  assert.match(yaml, /set -euo pipefail/);
  assert.match(yaml, /if ! git diff --cached --quiet; then/);
  assert.ok(!/continue-on-error:|always\(\)|git add \./.test(yaml), 'failures must block later commit/deploy');
});

test('all Pages actions skip private repositories and artifact contains site', () => {
  const yaml = workflow();
  const steps = yaml.split(/\n      - /).slice(1);
  const pages = steps.filter(step => /uses: actions\/(?:configure-pages|upload-pages-artifact|deploy-pages)@/.test(step));
  assert.equal(pages.length, 3);
  for (const step of pages) assert.ok(step.includes('if: ${{ github.event.repository.private == false }}'), 'private repository must skip every Pages step');
  assert.match(yaml, /path: site\n/);
});

test('Pages deployment uses the protected environment only after successful update', () => {
  const yaml = workflow();
  assert.match(yaml, /  deploy:\n    needs: update\n    if: \$\{\{ github.event.repository.private == false \}\}/);
  assert.match(yaml, /environment:\n      name: github-pages\n      url: \$\{\{ steps.deployment.outputs.page_url \}\}/);
});

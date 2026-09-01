'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const pluginRoot = path.resolve(__dirname, '..');

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  return source.slice(start, end);
}

function normalizeDocument(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function testDeepSeekRequestContract() {
  const source = fs.readFileSync(path.join(pluginRoot, 'code.js'), 'utf8');
  const functions = between(source, '/* DEEPSEEK_RULEBOOK_BUNDLE_START */', 'async function readDeepSeekSettings');
  const context = {};
  vm.createContext(context);
  vm.runInContext(functions, context);

  const repositoryRoot = path.resolve(pluginRoot, '..');
  const skill = normalizeDocument(fs.readFileSync(path.join(repositoryRoot, 'SKILL_UI_Mermaid_Writer_v1.3.md'), 'utf8'));
  const specification = normalizeDocument(fs.readFileSync(path.join(repositoryRoot, 'UI控件交互图_Mermaid转写规范_v2.3.md'), 'utf8'));
  assert.equal(context.DEEPSEEK_SKILL_DOCUMENT, skill, 'embedded Skill must match the complete source document');
  assert.equal(context.DEEPSEEK_SPECIFICATION_DOCUMENT, specification, 'embedded specification must match the complete source document');
  assert.equal(context.DEEPSEEK_RULEBOOK_MANIFEST.skillSha256, sha256(skill));
  assert.equal(context.DEEPSEEK_RULEBOOK_MANIFEST.specificationSha256, sha256(specification));

  const body = context.buildDeepSeekRequestBody({
    model: 'unknown-model',
    thinking: false,
    handoffText: '事实',
    nodeFacts: [{ name: 'frame_real' }]
  }, 0);
  assert.equal(body.model, 'deepseek-v4-pro');
  assert.equal(body.temperature, 0.1);
  assert.equal(body.thinking.type, 'disabled');
  assert.equal(body.response_format.type, 'json_object');
  assert.match(body.messages[0].content, /第一步：从【SKILL 原文开始】一直读到【SKILL 原文结束】，完整通读/);
  assert.match(body.messages[0].content, /第二步：从【规范原文开始】一直读到【规范原文结束】，完整通读/);
  assert.ok(body.messages[0].content.includes('【SKILL 原文开始】\n' + skill + '\n【SKILL 原文结束】'));
  assert.ok(body.messages[0].content.includes('【规范原文开始】\n' + specification + '\n【规范原文结束】'));
  assert.ok(body.messages[0].content.indexOf('【SKILL 原文结束】') < body.messages[0].content.indexOf('【规范原文开始】'));
  assert.match(body.messages[1].content, /未忽略业务节点清单 JSON/);

  const thinkingBody = context.buildDeepSeekRequestBody({ model: 'deepseek-v4-flash', thinking: true }, 0);
  assert.equal(thinkingBody.model, 'deepseek-v4-flash');
  assert.equal(thinkingBody.thinking.type, 'enabled');
  assert.equal(thinkingBody.reasoning_effort, 'high');
  assert.equal(Object.prototype.hasOwnProperty.call(thinkingBody, 'temperature'), false);

  const parsed = context.parseDeepSeekCompletion(JSON.stringify({
    mmd: '```mermaid\nsequenceDiagram\n    participant A as frame_real\n```',
    warnings: ['提醒'],
    evidence_gaps: ['缺口']
  }));
  assert.match(parsed.mmd, /^sequenceDiagram/);
  assert.deepEqual(Array.from(parsed.warnings), ['提醒']);
  assert.deepEqual(Array.from(parsed.evidenceGaps), ['缺口']);
}

async function testDeepSeekTransport() {
  const source = fs.readFileSync(path.join(pluginRoot, 'code.js'), 'utf8');
  const functions = between(source, 'var DEEPSEEK_SETTINGS_STORAGE_KEY', 'function sanitizeWorkspaceNavigationRecord');
  const posted = [];
  const writes = [];
  const requests = [];
  const testKey = 'test-key-local-only';
  const context = {
    figma: {
      clientStorage: {
        getAsync: async () => ({ apiKey: testKey, model: 'deepseek-v4-pro', thinking: false }),
        setAsync: async (key, value) => writes.push({ key, value })
      },
      ui: { postMessage: message => posted.push(message) }
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'deepseek-v4-pro',
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ mmd: 'sequenceDiagram\n    participant A as frame_real', warnings: [], evidence_gaps: [] }) } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        })
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(functions, context);
  await context.generateMmdWithDeepSeek({
    requestId: 'request-1',
    mode: 'generate',
    model: 'deepseek-v4-pro',
    thinking: false,
    handoffText: '事实',
    nodeFacts: [{ name: 'frame_real' }]
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.deepseek.com/chat/completions');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer ' + testKey);
  assert.equal(requests[0].options.body.includes(testKey), false, 'API key must not enter the JSON request body');
  assert.equal(posted.at(-1).type, 'deepseek-mmd-result');
  assert.equal(posted.at(-1).requestId, 'request-1');
  assert.equal(writes.length, 0);
}

function loadUiValidator() {
  const html = fs.readFileSync(path.join(pluginRoot, 'ui.html'), 'utf8');
  const scriptMatch = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
  assert.ok(scriptMatch, 'ui.html must contain an inline script');
  const functions = between(scriptMatch[1], '  function mmdIssue', '  function formatMmdValidation');
  const context = {};
  vm.createContext(context);
  vm.runInContext(functions, context);
  return context;
}

function validMmd() {
  return [
    'sequenceDiagram',
    '    participant Parent as 父容器<br/>(frame_parent)',
    '    participant Leaf as 图标<br/>(img_leaf)',
    '    rect rgb(240,240,240)',
    '    Note over Parent,Leaf: 初始摆放阶段',
    '    Parent->>Leaf: frame_parent 下摆出 img_leaf',
    '    end'
  ].join('\n');
}

function issueCodes(issues) {
  return Array.from(issues, issue => issue.code);
}

function testLocalGuardrails() {
  const context = loadUiValidator();
  const facts = {
    evidenceText: 'frame_parent / img_leaf / 动态显示',
    requiredNodeNames: ['frame_parent', 'img_leaf'],
    nodeFacts: []
  };
  assert.deepEqual(issueCodes(context.validateGeneratedMmd(validMmd(), facts)), []);

  const missing = context.validateGeneratedMmd(validMmd().replaceAll('img_leaf', 'semantic_icon'), facts);
  assert.ok(issueCodes(missing).includes('missing-real-nodes'));

  const invented = validMmd() + '\n    Parent->>Leaf: 创建列表项并刷新列表';
  const inventedCodes = issueCodes(context.validateGeneratedMmd(invented, facts));
  assert.ok(inventedCodes.includes('unsupported-behavior'));

  const runtimeInitial = validMmd().replace('frame_parent 下摆出 img_leaf', '满足条件后刷新列表');
  assert.ok(issueCodes(context.validateGeneratedMmd(runtimeInitial, facts)).includes('runtime-in-initial'));

  const fenced = '```mermaid\n' + validMmd() + '\n```';
  assert.ok(issueCodes(context.validateGeneratedMmd(fenced, facts)).includes('code-fence'));

  const unknownRef = validMmd() + '\n    Note over Parent: `invented_node`';
  assert.ok(issueCodes(context.validateGeneratedMmd(unknownRef, facts)).includes('unknown-node-refs'));

  const knownResource = validMmd() + '\n    Note over Parent: img_leaf 使用 `MI_Hero_Avatar`';
  const resourceFacts = { evidenceText: 'img_leaf 使用 MI_Hero_Avatar', requiredNodeNames: facts.requiredNodeNames, nodeFacts: [] };
  assert.equal(issueCodes(context.validateGeneratedMmd(knownResource, resourceFacts)).includes('unknown-node-refs'), false);

  const supported = validMmd() + '\n    Parent->>Leaf: 创建列表项';
  const supportedFacts = { evidenceText: '明确要求创建列表项', requiredNodeNames: facts.requiredNodeNames, nodeFacts: [] };
  assert.equal(issueCodes(context.validateGeneratedMmd(supported, supportedFacts)).includes('unsupported-behavior'), false);
}

function testManifestNetworkScope() {
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.networkAccess.allowedDomains, ['https://api.deepseek.com']);
}

async function main() {
  testDeepSeekRequestContract();
  await testDeepSeekTransport();
  testLocalGuardrails();
  testManifestNetworkScope();
  console.log('DeepSeek MMD guardrail regression tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

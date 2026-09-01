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
    handoffEdited: true,
    handoffText: '事实',
    structureContracts: [{
      component: 'frame_real',
      componentRole: 'main',
      paths: [{ text: 'frame_real → img_leaf', nodes: ['frame_real', 'img_leaf'] }]
    }],
    participantRoles: [{ component: 'frame_real', name: 'frame_real', chineseRole: '真实组件' }]
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
  assert.doesNotMatch(body.messages[1].content, /未忽略业务节点清单 JSON/);
  assert.match(body.messages[1].content, /完整交接资料（主要输入）/);
  assert.match(body.messages[1].content, /本次必须覆盖的结构链（确定性校验契约）/);
  assert.match(body.messages[1].content, /frame_real → img_leaf/);
  assert.match(body.messages[1].content, /participant 中文作用字典/);
  assert.match(body.messages[1].content, /当前交接资料模式：用户手动修改版/);
  assert.match(body.messages[1].content, /完整交接资料是本次生成的主要输入/);

  const repairBody = context.buildDeepSeekRequestBody({
    mode: 'repair',
    handoffText: '事实',
    draftMmd: 'sequenceDiagram',
    validationIssues: [{ code: 'missing-structure-chains', message: '遗漏结构链' }]
  }, 0);
  assert.match(repairBody.messages[1].content, /执行最小范围修正/);
  assert.match(repairBody.messages[1].content, /不得顺便概括、缩写、润色或重写整份 MMD/);
  assert.match(repairBody.messages[1].content, /\[missing-structure-chains\] 遗漏结构链/);

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
  let context;
  context = {
    figma: {
      clientStorage: {
        getAsync: async () => ({ apiKey: testKey, model: 'deepseek-v4-pro', thinking: false }),
        setAsync: async (key, value) => writes.push({ key, value })
      },
      ui: { postMessage: message => {
        posted.push(message);
        if (message.type === 'deepseek-fetch-request') {
          requests.push(message);
          Promise.resolve().then(() => context.handleDeepSeekUiFetchResult({
            fetchId: message.fetchId,
            ok: true,
            status: 200,
            bodyText: JSON.stringify({
              model: 'deepseek-v4-pro',
              choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ mmd: 'sequenceDiagram\n    participant A as frame_real', warnings: [], evidence_gaps: [] }) } }],
              usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
            })
          }));
        }
      } }
    },
    setTimeout,
    clearTimeout
  };
  vm.createContext(context);
  vm.runInContext(functions, context);
  await context.generateMmdWithDeepSeek({
    requestId: 'request-1',
    mode: 'generate',
    model: 'deepseek-v4-pro',
    thinking: false,
    handoffText: '事实',
    structureContracts: [{ component: 'frame_real', componentRole: 'main', paths: [{ text: 'frame_real → img_leaf' }] }],
    participantRoles: [{ component: 'frame_real', name: 'frame_real', chineseRole: '真实组件' }]
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.deepseek.com/chat/completions');
  assert.equal(requests[0].apiKey, testKey);
  assert.equal(JSON.stringify(requests[0].requestBody).includes(testKey), false, 'API key must not enter the JSON request body');
  assert.equal(posted.at(-1).type, 'deepseek-mmd-result');
  assert.equal(posted.at(-1).requestId, 'request-1');
  assert.equal(writes.length, 0);
}

async function testUiFetchBridge() {
  const html = fs.readFileSync(path.join(pluginRoot, 'ui.html'), 'utf8');
  const scriptMatch = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
  assert.ok(scriptMatch, 'ui.html must contain an inline script');
  const functions = between(scriptMatch[1], '  async function performDeepSeekFetch', '  window.onmessage = function');
  const requests = [];
  const posted = [];
  const context = {
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, text: async () => '{"choices":[]}' };
    },
    parent: { postMessage: message => posted.push(message) }
  };
  vm.createContext(context);
  vm.runInContext(functions, context);
  await context.performDeepSeekFetch({
    fetchId: 'fetch-1',
    url: 'https://api.deepseek.com/chat/completions',
    apiKey: 'transient-key',
    requestBody: { model: 'deepseek-v4-pro' }
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer transient-key');
  assert.equal(requests[0].options.body.includes('transient-key'), false);
  assert.equal(posted[0].pluginMessage.type, 'deepseek-fetch-result');
  assert.equal(posted[0].pluginMessage.status, 200);

  const fallbackRequests = [];
  const fallbackPosted = [];
  const fallbackContext = {
    fetch: async (url, options) => {
      fallbackRequests.push({ url, options });
      if (url === 'https://api.deepseek.com/chat/completions') throw new TypeError('Failed to fetch');
      return { ok: true, status: 200, text: async () => '{"choices":[]}' };
    },
    parent: { postMessage: message => fallbackPosted.push(message) }
  };
  vm.createContext(fallbackContext);
  vm.runInContext(functions, fallbackContext);
  await fallbackContext.performDeepSeekFetch({
    fetchId: 'fetch-2',
    url: 'https://api.deepseek.com/chat/completions',
    apiKey: 'transient-key',
    requestBody: { model: 'deepseek-v4-pro' }
  });
  assert.deepEqual(fallbackRequests.map(item => item.url), [
    'https://api.deepseek.com/chat/completions',
    'http://localhost:17823/deepseek/chat/completions'
  ]);
  assert.equal(fallbackPosted[0].pluginMessage.transport, 'local-bridge');
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

function loadUiStructureContractBuilder() {
  const html = fs.readFileSync(path.join(pluginRoot, 'ui.html'), 'utf8');
  const scriptMatch = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
  assert.ok(scriptMatch, 'ui.html must contain an inline script');
  const functions = between(scriptMatch[1], '  function splitStructurePath', '  function buildMmdGenerationContext');
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
    '    Parent->>Leaf: frame_parent → img_leaf',
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
    nodeFacts: [],
    structureContracts: [{ component: 'frame_parent', componentRole: 'main', paths: [{ text: 'frame_parent → img_leaf' }] }]
  };
  assert.deepEqual(issueCodes(context.validateGeneratedMmd(validMmd(), facts)), []);

  const missing = context.validateGeneratedMmd(validMmd().replaceAll('img_leaf', 'semantic_icon'), facts);
  assert.ok(issueCodes(missing).includes('missing-real-nodes'));

  const invented = validMmd() + '\n    Parent->>Leaf: 创建列表项并刷新列表';
  const inventedCodes = issueCodes(context.validateGeneratedMmd(invented, facts));
  assert.ok(inventedCodes.includes('unsupported-behavior'));

  const runtimeInitial = validMmd().replace('frame_parent → img_leaf', '满足条件后刷新列表');
  assert.ok(issueCodes(context.validateGeneratedMmd(runtimeInitial, facts)).includes('runtime-in-initial'));

  const conditionalInitial = validMmd().replace('frame_parent → img_leaf', '未满足动态属性出现条件时，frame_dynamic_buff 中不显示 frame_hud_dynamic_attribute 条目');
  assert.ok(issueCodes(context.validateGeneratedMmd(conditionalInitial, facts)).includes('runtime-in-initial'));

  const flattenedStructure = validMmd().replace('frame_parent → img_leaf', 'frame_parent 负责父容器；img_leaf 负责图标');
  const flattenedCodes = issueCodes(context.validateGeneratedMmd(flattenedStructure, facts));
  assert.equal(flattenedCodes.includes('missing-real-nodes'), false, 'scattered node names still satisfy the legacy name check');
  assert.ok(flattenedCodes.includes('missing-structure-chains'), 'scattered node names must not satisfy structural coverage');

  const chainOutsideInitial = validMmd().replace('frame_parent → img_leaf', 'frame_parent 与 img_leaf 已初始化') + '\n    Note over Parent,Leaf: frame_parent → img_leaf';
  assert.ok(issueCodes(context.validateGeneratedMmd(chainOutsideInitial, facts)).includes('missing-structure-chains'), 'required chains must be inside the initial phase');

  const exactRoleMmd = validMmd() + '\n    participant AttrList as 英雄头像和该英雄造成影响的技能图标/装备图标的组件<br/>(frame_hud_dynamic_attribute_list)';
  const exactRoleFacts = {
    evidenceText: facts.evidenceText,
    requiredNodeNames: facts.requiredNodeNames,
    nodeFacts: [{ name: 'frame_hud_dynamic_attribute_list', chineseRole: '英雄头像和该英雄造成影响的技能图标/装备图标的组件' }]
  };
  assert.equal(issueCodes(context.validateGeneratedMmd(exactRoleMmd, exactRoleFacts)).includes('participant-role-rewritten'), false);
  const rewrittenRoleMmd = exactRoleMmd.replace('英雄头像和该英雄造成影响的技能图标/装备图标的组件', '英雄头像和技能/装备图标排列组件');
  assert.ok(issueCodes(context.validateGeneratedMmd(rewrittenRoleMmd, exactRoleFacts)).includes('participant-role-rewritten'));

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

function testStructureContracts() {
  const context = loadUiStructureContractBuilder();
  const snapshots = [{
    name: 'buff_pc',
    role: 'main',
    entries: [
      { pathText: 'buff_pc' },
      { pathText: 'buff_pc / frame_dynamic_buff' },
      { pathText: 'buff_pc / frame_dynamic_buff / frame_hud_dynamic_attribute' },
      { pathText: 'buff_pc / frame_other' }
    ]
  }, {
    name: 'frame_hud_dynamic_attribute',
    role: 'linked',
    relation: '主组件调用',
    entries: [
      { pathText: 'frame_hud_dynamic_attribute' },
      { pathText: 'frame_hud_dynamic_attribute / frame_attribute_attribute / frame_attribute / txt_attribute_num' },
      { pathText: 'frame_hud_dynamic_attribute / frame_attribute_attribute / frame_attribute / img_attribute' }
    ]
  }];
  const contracts = JSON.parse(JSON.stringify(context.buildStructureContractsFromSnapshots(snapshots)));
  assert.deepEqual(contracts, [{
    component: 'buff_pc',
    componentRole: 'main',
    relation: '',
    paths: [
      { nodes: ['buff_pc', 'frame_dynamic_buff', 'frame_hud_dynamic_attribute'], text: 'buff_pc → frame_dynamic_buff → frame_hud_dynamic_attribute' },
      { nodes: ['buff_pc', 'frame_other'], text: 'buff_pc → frame_other' }
    ]
  }, {
    component: 'frame_hud_dynamic_attribute',
    componentRole: 'linked',
    relation: '主组件调用',
    paths: [
      { nodes: ['frame_hud_dynamic_attribute', 'frame_attribute_attribute', 'frame_attribute', 'txt_attribute_num'], text: 'frame_hud_dynamic_attribute → frame_attribute_attribute → frame_attribute → txt_attribute_num' },
      { nodes: ['frame_hud_dynamic_attribute', 'frame_attribute_attribute', 'frame_attribute', 'img_attribute'], text: 'frame_hud_dynamic_attribute → frame_attribute_attribute → frame_attribute → img_attribute' }
    ]
  }]);

  const roles = JSON.parse(JSON.stringify(context.buildParticipantRoleDictionary([
    { component: 'buff_pc', name: 'buff_pc', chineseRole: '动态属性承载组件' },
    { component: 'buff_pc', name: 'buff_pc', chineseRole: '重复值不会重复输出' },
    { component: 'buff_pc', name: 'frame_empty', chineseRole: '' }
  ])));
  assert.deepEqual(roles, [{ component: 'buff_pc', name: 'buff_pc', chineseRole: '动态属性承载组件' }]);
}

function testManifestNetworkScope() {
  const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.networkAccess.allowedDomains, ['https://api.deepseek.com']);
  assert.deepEqual(manifest.networkAccess.devAllowedDomains, ['http://localhost:17823']);
}

async function main() {
  testDeepSeekRequestContract();
  await testDeepSeekTransport();
  await testUiFetchBridge();
  testStructureContracts();
  testLocalGuardrails();
  testManifestNetworkScope();
  console.log('DeepSeek MMD guardrail regression tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

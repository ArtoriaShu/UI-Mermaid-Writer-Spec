'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const pluginRoot = path.resolve(__dirname, '..');

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `missing marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing marker: ${endMarker}`);
  return source.slice(start, end);
}

function testEditableHandoffState() {
  const html = fs.readFileSync(path.join(pluginRoot, 'ui.html'), 'utf8');
  assert.match(html, /id="editHandoff"[^>]*>修改交接文档</);
  assert.match(html, /id="resetHandoff"[^>]*>恢复自动生成</);
  assert.match(html, /var handoffText = currentHandoffText\(\);/);
  assert.match(html, /handoffEdited: context\.handoffEdited === true/);

  const scriptMatch = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
  assert.ok(scriptMatch, 'ui.html must contain an inline script');
  const functions = between(scriptMatch[1], '  function hasHandoffOverride', '  function buildMmdGenerationContext');
  const classes = new Set();
  const context = {
    workspace: {},
    mainState: () => ({}),
    buildAiLines: () => ['自动版本 A'],
    aiOutput: { value: '自动版本 A', readOnly: true, classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } },
    editHandoffEl: { textContent: '', classList: { toggle() {} } },
    resetHandoffEl: { style: {} },
    handoffEditing: false
  };
  vm.createContext(context);
  vm.runInContext(functions, context);

  assert.equal(context.currentHandoffText(), '自动版本 A');
  context.aiOutput.value = '【手动测试修正】\n业务内容 B';
  context.persistHandoffEditorText();
  assert.equal(context.workspace.handoffManualOverride, true);
  assert.equal(context.currentHandoffText(), '【手动测试修正】\n业务内容 B');

  context.buildAiLines = () => ['自动版本 C'];
  assert.equal(context.currentHandoffText(), '【手动测试修正】\n业务内容 B', 'automatic refresh must not overwrite a manual handoff');
  assert.equal(context.workspace.handoffAutoText, '自动版本 C');
}

testEditableHandoffState();
console.log('Editable handoff regression tests passed.');

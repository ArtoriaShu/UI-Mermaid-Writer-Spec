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

function componentNode(id, name, visible, children) {
  return { id, name, type: 'COMPONENT', visible, locked: false, children: children || [], variantProperties: {} };
}

function frameNode(id, name, visible, children) {
  return { id, name, type: 'FRAME', visible, locked: false, children: children || [] };
}

function testBackendSerialization() {
  const source = fs.readFileSync(path.join(pluginRoot, 'code.js'), 'utf8');
  const functions = between(source, 'function canHaveChildren', 'function currentSelectionPayload');
  const context = {};
  vm.createContext(context);
  vm.runInContext(functions, context);

  const normal = frameNode('normal', 'normal', false, [frameNode('normal-child', 'normal-child', true)]);
  const normalResult = context.serializeNode(normal, true, true);
  assert.equal(normalResult.children[0].effectiveVisible, false, 'ordinary hidden parent must hide descendants effectively');

  const variant = componentNode('variant', 'State=Off', false, [frameNode('variant-child', 'variant-child', true)]);
  const set = {
    id: 'set',
    name: 'Control',
    type: 'COMPONENT_SET',
    visible: false,
    locked: false,
    children: [variant],
    variantGroupProperties: {}
  };
  const setResult = context.serializeComponentSet(set);
  assert.equal(setResult.variantSet.variants[0].root.visible, false, 'raw Variant root visibility must be retained for diagnostics');
  assert.equal(setResult.variantSet.variants[0].root.effectiveVisible, true, 'Variant root must be neutral for business visibility');
  assert.equal(setResult.variantSet.variants[0].root.children[0].effectiveVisible, true, 'Variant root visibility must not hide internal nodes');
}

function uiVariant(name, rootVisible, children) {
  return {
    id: name,
    name,
    root: componentNode(`${name}-root`, `${name}-root`, rootVisible, children)
  };
}

function testUiVariantDiff() {
  const html = fs.readFileSync(path.join(pluginRoot, 'ui.html'), 'utf8');
  const scriptMatch = html.match(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i);
  assert.ok(scriptMatch, 'ui.html must contain an inline script');
  const functions = between(scriptMatch[1], '  function variantNodeRecords', '  function renderVariantManager');
  const context = {
    orderEl: { value: 'figma' },
    effectiveIgnoredIdMapForState: () => Object.create(null)
  };
  vm.createContext(context);
  vm.runInContext(functions, context);

  const hiddenRoot = uiVariant('hidden-root', false, [frameNode('inside', 'inside', true)]);
  const records = context.variantNodeRecords(hiddenRoot);
  assert.equal(records[0].effectiveVisible, true, 'UI comparison must ignore Variant root visibility');

  const baseRawOnly = uiVariant('base-raw', true, [
    frameNode('parent-a', 'parent', false, [frameNode('leaf-a', 'leaf', true)])
  ]);
  const currentRawOnly = uiVariant('current-raw', true, [
    frameNode('parent-b', 'parent', false, [frameNode('leaf-b', 'leaf', false)])
  ]);
  const rawOnlyDiff = context.variantDiff({}, currentRawOnly, baseRawOnly);
  assert.equal(rawOnlyDiff.changed.length, 0, 'rawVisible-only changes must not become business Delta');

  const currentEffective = uiVariant('current-effective', true, [
    frameNode('parent-c', 'parent', true, [frameNode('leaf-c', 'leaf', true)])
  ]);
  const effectiveDiff = context.variantDiff({}, currentEffective, baseRawOnly);
  assert.ok(effectiveDiff.changed.length >= 1, 'effectiveVisible changes must become business Delta');
}

testBackendSerialization();
testUiVariantDiff();
console.log('Variant semantics regression tests passed.');

// UI Node Tree & Notes Exporter
// Concept & Vibe Coding by Shu
// Version: v10.10 Preview

figma.showUI(__html__, {
  width: 1060,
  height: 920,
  themeColors: true
});

// 插件主动定位子节点时，selectionchange 不应把它误当成新的主组件。
var pluginSelectionTargetId = '';
// “添加关联组件”模式：下一次用户主动选择会作为关联组件返回给 UI，主组件不变。
var linkedSelectionMode = false;
// 状态快照页可临时固定当前组件：用户在 Figma 中选择子层级时不重新定义插件根组件。
var rootSelectionPinned = false;

function canHaveChildren(node) {
  return node && 'children' in node;
}

// 组件边界规则：当前选中的根节点可以展开；其内部遇到 INSTANCE 子组件时只记录实例根节点，
// 不继续读取实例内部层级。子组件内部结构由“关联组件”独立维护。
function serializeNode(node, isRoot, ancestorEffectiveVisible, ignoreRootVisibilityForDescendants) {
  var rawVisible = 'visible' in node ? node.visible !== false : true;
  // Component Set 中每个 Variant 根组件只是承载变体的 Figma 容器。
  // 根组件自身在画布里的 visible 不向内部业务节点传播；普通组件和普通父节点仍按原规则继承。
  var rootVisibilityNeutral = isRoot === true && ignoreRootVisibilityForDescendants === true;
  var effectiveVisible = ancestorEffectiveVisible !== false && (rootVisibilityNeutral || rawVisible);
  var data = {
    id: node.id,
    name: node.name || '(未命名)',
    type: node.type,
    // visible 保持“节点自身显隐”，供节点树的 [当前Figma隐藏] 使用。
    visible: rawVisible,
    // 状态快照可使用有效显隐：父级隐藏时，子级也视为隐藏。
    effectiveVisible: effectiveVisible,
    locked: 'locked' in node ? node.locked === true : false,
    children: []
  };

  var stopAtComponentBoundary = node.type === 'INSTANCE' && isRoot !== true;
  if (canHaveChildren(node) && !stopAtComponentBoundary) {
    var children = Array.prototype.slice.call(node.children || []);
    for (var i = 0; i < children.length; i++) data.children.push(serializeNode(children[i], false, effectiveVisible));
  }
  return data;
}

function shallowCopyStringMap(value) {
  var out = {};
  if (!value || typeof value !== 'object') return out;
  var keys = Object.keys(value);
  for (var i = 0; i < keys.length; i++) out[keys[i]] = String(value[keys[i]] == null ? '' : value[keys[i]]);
  return out;
}

function serializeVariantGroupProperties(node) {
  var out = {};
  try {
    var src = node && node.variantGroupProperties;
    if (!src || typeof src !== 'object') return out;
    var keys = Object.keys(src);
    for (var i = 0; i < keys.length; i++) {
      var item = src[keys[i]] || {};
      out[keys[i]] = {
        values: Array.isArray(item.values) ? item.values.map(function(v){ return String(v); }) : []
      };
    }
  } catch (err) {}
  return out;
}

function serializeComponentSet(node) {
  var rawVisible = 'visible' in node ? node.visible !== false : true;
  var effectiveVisible = rawVisible;
  var variants = [];
  var children = Array.prototype.slice.call(node.children || []);
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (!child || child.type !== 'COMPONENT') continue;
    // Component Set 与 Variant 根组件的画布可见性都不参与 Variant 内部业务显隐比较。
    var root = serializeNode(child, true, true, true);
    var props = {};
    try { props = shallowCopyStringMap(child.variantProperties); } catch (err) {}
    variants.push({
      id: child.id,
      name: child.name || '(未命名变体)',
      properties: props,
      root: root
    });
  }

  // Component Set 的业务节点树只展示一个结构基准（Figma 中排序最前的变体）一次。
  // 其余变体完整结构保存在 variantSet.variants 中，交给 UI 做显隐/结构 Delta，不重复展开节点树。
  var base = variants.length ? variants[0] : null;
  return {
    id: node.id,
    name: node.name || '(未命名)',
    type: node.type,
    visible: rawVisible,
    effectiveVisible: effectiveVisible,
    locked: 'locked' in node ? node.locked === true : false,
    children: base && base.root && Array.isArray(base.root.children) ? base.root.children : [],
    variantSet: {
      enabled: true,
      baselineVariantId: base ? base.id : '',
      baselineVariantName: base ? base.name : '',
      groupProperties: serializeVariantGroupProperties(node),
      variants: variants
    }
  };
}

function serializeWorkspaceRoot(node) {
  if (node && node.type === 'COMPONENT_SET') return serializeComponentSet(node);
  return serializeNode(node, true, true);
}

function currentSelectionPayload() {
  var selection = Array.prototype.slice.call(figma.currentPage.selection || []);
  var roots = [];
  for (var i = 0; i < selection.length; i++) roots.push(serializeWorkspaceRoot(selection[i]));
  return {
    designName: (figma.root && figma.root.name) ? String(figma.root.name) : '',
    fileKey: (typeof figma.fileKey === 'string' && figma.fileKey) ? String(figma.fileKey) : '',
    pageName: figma.currentPage.name,
    roots: roots
  };
}

function sendSelection() {
  var payload = currentSelectionPayload();
  if (!payload.roots.length) {
    figma.ui.postMessage({
      type: 'selection-data',
      designName: payload.designName,
      fileKey: payload.fileKey,
      pageName: payload.pageName,
      roots: [],
      message: '请先在 Figma 画布或 Layers 面板中选择一个业务组件 / Frame。'
    });
    return;
  }
  figma.ui.postMessage({
    type: 'selection-data',
    designName: payload.designName,
    fileKey: payload.fileKey,
    pageName: payload.pageName,
    roots: payload.roots,
    message: ''
  });
}

function sendLinkedSelection() {
  var payload = currentSelectionPayload();
  if (!payload.roots.length) {
    figma.ui.postMessage({
      type: 'linked-selection-error',
      message: '没有选择关联组件，请重新点击“添加关联组件”后再选择。'
    });
    return;
  }
  if (payload.roots.length !== 1) {
    figma.ui.postMessage({
      type: 'linked-selection-error',
      message: '一次只能添加 1 个关联组件，请只选择一个 Frame / Component / Instance / Component Set。'
    });
    return;
  }
  figma.ui.postMessage({
    type: 'linked-selection-data',
    designName: payload.designName,
    fileKey: payload.fileKey,
    pageName: payload.pageName,
    roots: payload.roots
  });
}


async function captureComponentState(msg) {
  try {
    var rootId = String(msg.rootId || '');
    if (!rootId) throw new Error('缺少组件根节点 ID');
    var node = await figma.getNodeByIdAsync(rootId);
    if (!node) throw new Error('找不到需要记录状态的组件根节点');
    if (node.type === 'DOCUMENT' || node.type === 'PAGE') throw new Error('DOCUMENT / PAGE 不能作为组件状态根节点');

    var page = node;
    while (page && page.type !== 'PAGE' && page.type !== 'DOCUMENT') page = page.parent;
    figma.ui.postMessage({
      type: 'component-state-captured',
      requestId: String(msg.requestId || ''),
      pageName: page && page.type === 'PAGE' ? page.name : figma.currentPage.name,
      root: serializeWorkspaceRoot(node)
    });
  } catch (err) {
    figma.ui.postMessage({
      type: 'component-state-capture-error',
      requestId: String(msg.requestId || ''),
      message: err && err.message ? err.message : String(err)
    });
  }
}

async function loadNavigationComponent(msg) {
  try {
    var node = await figma.getNodeByIdAsync(String(msg.id || ''));
    if (!node) throw new Error('找不到对应的 Figma 组件');
    if (node.type === 'DOCUMENT' || node.type === 'PAGE') throw new Error('该节点不能作为组件根节点');

    var page = node;
    while (page && page.type !== 'PAGE' && page.type !== 'DOCUMENT') page = page.parent;
    pluginSelectionTargetId = node.id;
    if (page && page.type === 'PAGE' && page.id !== figma.currentPage.id) {
      if (typeof figma.setCurrentPageAsync === 'function') await figma.setCurrentPageAsync(page);
      else figma.currentPage = page;
    }
    figma.currentPage.selection = [node];
    if (msg.focus === true) figma.viewport.scrollAndZoomIntoView([node]);

    figma.ui.postMessage({
      type: 'navigation-component-data',
      designName: (figma.root && figma.root.name) ? String(figma.root.name) : '',
      fileKey: (typeof figma.fileKey === 'string' && figma.fileKey) ? String(figma.fileKey) : '',
      pageName: page && page.type === 'PAGE' ? page.name : figma.currentPage.name,
      root: serializeWorkspaceRoot(node)
    });
  } catch (err) {
    pluginSelectionTargetId = '';
    figma.ui.postMessage({ type:'navigation-component-error', message: err && err.message ? err.message : String(err) });
  }
}

async function selectNodeFromPlugin(msg) {
  try {
    var node = await figma.getNodeByIdAsync(String(msg.id || ''));
    if (!node) throw new Error('找不到对应的 Figma 节点');
    if (node.type === 'DOCUMENT' || node.type === 'PAGE') throw new Error('该节点不能作为画布选区');

    var page = node;
    while (page && page.type !== 'PAGE' && page.type !== 'DOCUMENT') page = page.parent;

    // 同一 Design 跨 Page 的关联组件允许直接定位。切 Page 属于本地 Figma 操作，
    // 不会替换当前插件工作区中的主组件。
    pluginSelectionTargetId = node.id;
    if (page && page.type === 'PAGE' && page.id !== figma.currentPage.id) {
      if (typeof figma.setCurrentPageAsync === 'function') await figma.setCurrentPageAsync(page);
      else figma.currentPage = page;
    }
    figma.currentPage.selection = [node];
    if (msg.focus === true) figma.viewport.scrollAndZoomIntoView([node]);

    figma.ui.postMessage({
      type: 'node-selected',
      id: node.id,
      name: node.name || '(未命名)',
      focused: msg.focus === true
    });
  } catch (err) {
    pluginSelectionTargetId = '';
    figma.ui.postMessage({
      type: 'node-select-error',
      id: String(msg.id || ''),
      message: err && err.message ? err.message : String(err)
    });
  }
}


// v10.6：跨 Design 工作区导航保存在本机 clientStorage。
// 这里只保存“主组件 + 关联组件”的轻量导航信息，不保存 Figma 文档内容，也不联网。
var WORKSPACE_NAV_STORAGE_KEY = 'ui-node-tree-workspace-nav-v1';
var workspaceNavWriteQueue = Promise.resolve();

function sanitizeWorkspaceNavigationRecord(value) {
  if (!value || typeof value !== 'object') return null;
  var workspaceId = String(value.workspaceId || '').trim();
  var entries = Array.isArray(value.entries) ? value.entries : [];
  if (!workspaceId || !entries.length) return null;
  var cleanEntries = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i] || {};
    var name = String(e.name || '').trim();
    if (!name) continue;
    cleanEntries.push({
      role: e.role === 'main' ? 'main' : 'linked',
      name: name,
      sourceDesign: String(e.sourceDesign || ''),
      sourcePage: String(e.sourcePage || ''),
      sourceUrl: String(e.sourceUrl || ''),
      sourceFileKey: String(e.sourceFileKey || ''),
      originalRootId: String(e.originalRootId || ''),
      sourceType: String(e.sourceType || '')
    });
  }
  if (!cleanEntries.length) return null;
  return {
    version: 1,
    workspaceId: workspaceId,
    name: String(value.name || cleanEntries[0].name || 'UI 工作区'),
    updatedAt: String(value.updatedAt || new Date().toISOString()),
    entries: cleanEntries
  };
}

async function readWorkspaceNavigationStore() {
  try {
    var raw = await figma.clientStorage.getAsync(WORKSPACE_NAV_STORAGE_KEY);
    var list = Array.isArray(raw) ? raw : [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var rec = sanitizeWorkspaceNavigationRecord(list[i]);
      if (rec) out.push(rec);
    }
    return out;
  } catch (err) {
    return [];
  }
}

async function postWorkspaceNavigationStore() {
  var list = await readWorkspaceNavigationStore();
  figma.ui.postMessage({ type: 'workspace-navigation-data', navigations: list });
}

function queueWorkspaceNavigationSave(value) {
  var rec = sanitizeWorkspaceNavigationRecord(value);
  if (!rec) return;
  workspaceNavWriteQueue = workspaceNavWriteQueue.then(async function(){
    var list = await readWorkspaceNavigationStore();
    var next = [rec];
    for (var i = 0; i < list.length; i++) {
      if (list[i].workspaceId === rec.workspaceId) continue;
      next.push(list[i]);
      if (next.length >= 30) break;
    }
    await figma.clientStorage.setAsync(WORKSPACE_NAV_STORAGE_KEY, next);
    figma.ui.postMessage({ type: 'workspace-navigation-data', navigations: next });
  }).catch(function(){});
}

figma.ui.onmessage = function(msg) {
  if (!msg || !msg.type) return;

  if (msg.type === 'request-workspace-navigation') {
    postWorkspaceNavigationStore();
    return;
  }

  if (msg.type === 'save-workspace-navigation') {
    queueWorkspaceNavigationSave(msg.navigation);
    return;
  }

  if (msg.type === 'request-selection') {
    linkedSelectionMode = false;
    sendSelection();
    return;
  }

  if (msg.type === 'begin-linked-selection') {
    linkedSelectionMode = true;
    figma.notify('请选择 1 个关联组件；可切换到同一 Design 的其他 Page');
    return;
  }

  if (msg.type === 'cancel-linked-selection') {
    linkedSelectionMode = false;
    return;
  }

  if (msg.type === 'set-root-selection-pinned') {
    rootSelectionPinned = msg.enabled === true;
    return;
  }

  if (msg.type === 'select-node') {
    selectNodeFromPlugin(msg);
    return;
  }

  if (msg.type === 'load-navigation-component') {
    loadNavigationComponent(msg);
    return;
  }

  if (msg.type === 'capture-component-state') {
    captureComponentState(msg);
    return;
  }

  if (msg.type === 'notify') {
    figma.notify(msg.message || '完成');
    return;
  }

  if (msg.type === 'resize') {
    var width = Math.max(760, Math.min(1280, Number(msg.width) || 1060));
    var height = Math.max(680, Math.min(1150, Number(msg.height) || 920));
    figma.ui.resize(width, height);
  }
};

figma.on('selectionchange', function() {
  var selection = Array.prototype.slice.call(figma.currentPage.selection || []);

  if (pluginSelectionTargetId) {
    var isPluginSelection = selection.length === 1 && selection[0].id === pluginSelectionTargetId;
    if (isPluginSelection) {
      pluginSelectionTargetId = '';
      return;
    }
    // 跨 Page 定位时 Figma 可能先触发一次空选区 selectionchange。
    // 这不是用户重新选择主组件，保持目标 ID，等待真正的目标节点选中事件。
    if (!selection.length) return;
    // 若出现了另一个非空选区，视为用户主动打断本次定位，再恢复正常选区逻辑。
    pluginSelectionTargetId = '';
  }

  if (linkedSelectionMode) {
    // 切换 Page 时可能先触发一次空选区 selectionchange；保持等待，不要误判为失败。
    if (!selection.length) return;
    linkedSelectionMode = false;
    sendLinkedSelection();
    return;
  }

  if (rootSelectionPinned) return;

  sendSelection();
});

figma.on('currentpagechange', function() {
  // 添加关联组件模式下允许跨 Page：切换 Page 后继续等待用户选择，主组件不变。
  if (linkedSelectionMode) {
    // 清空目标 Page 原有选区，避免切 Page 时把该 Page 之前残留的选中节点误添加为关联组件。
    try { figma.currentPage.selection = []; } catch (err) {}
    figma.ui.postMessage({
      type: 'linked-page-changed',
      pageName: figma.currentPage.name,
      message: '已切换到 Page：' + figma.currentPage.name + '，请继续选择 1 个关联组件。'
    });
    return;
  }

  // 插件主动定位跨 Page 节点，以及状态页固定根组件时，都不把新 Page 选区当作新的主组件。
  if (pluginSelectionTargetId || rootSelectionPinned) return;
  sendSelection();
});

sendSelection();
postWorkspaceNavigationStore();

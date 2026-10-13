'use strict';
const { Plugin } = require('obsidian');
const { PenBridge } = require('./pen-bridge');
const { PenTextSelection } = require('./text-selection');

module.exports = class CanvasPenBridge extends Plugin {
  onload() {
    this.bridges = new Map();
    this.textDocuments = new Map();
    this.sync = this.sync.bind(this);
    this.registerEvent(this.app.workspace.on('layout-change', this.sync));
    this.app.workspace.onLayoutReady(this.sync);
  }

  sync() {
    const canvases = new Set();
    for (const leaf of this.app.workspace.getLeavesOfType('canvas')) {
      const canvas = leaf.view.canvas;
      if (canvas?.wrapperEl?.isConnected) canvases.add(canvas);
    }
    for (const [canvas, bridge] of this.bridges) {
      if (!canvases.has(canvas)) {
        bridge.destroy();
        this.bridges.delete(canvas);
      }
    }
    for (const canvas of canvases) {
      if (this.bridges.has(canvas)) continue;
      // Canvas runtime access is private. Unsupported versions fail closed.
      if (typeof canvas.panBy !== 'function' || typeof canvas.zoomBy !== 'function'
        || typeof canvas.domPosFromEvt !== 'function') continue;
      this.bridges.set(canvas, new PenBridge(canvas));
    }
    const documents = new Set([document]);
    for (const leaf of [...this.app.workspace.getLeavesOfType('canvas'), ...this.app.workspace.getLeavesOfType('markdown')]) {
      documents.add(leaf.view.containerEl.ownerDocument);
    }
    for (const doc of [...documents]) {
      for (const frame of doc.querySelectorAll('.canvas-node iframe.embed-iframe')) {
        try { if (frame.contentDocument) documents.add(frame.contentDocument); } catch (_) { /* Other origin. */ }
      }
    }
    for (const [doc, entry] of this.textDocuments) {
      if (!documents.has(doc)) { entry.destroy(); this.textDocuments.delete(doc); }
    }
    for (const doc of documents) {
      if (this.textDocuments.has(doc)) continue;
      const bridge = new PenTextSelection(doc, target => this.findEditor(target));
      const syncFrames = () => this.sync();
      doc.addEventListener('load', syncFrames, true);
      const observer = new doc.defaultView.MutationObserver(records => {
        if (records.some(r => [...r.addedNodes, ...r.removedNodes].some(n => n.nodeType === 1
          && (n.matches('iframe') || n.querySelector('iframe'))))) this.sync();
      });
      observer.observe(doc, { childList: true, subtree: true });
      this.textDocuments.set(doc, { bridge, destroy() { observer.disconnect(); doc.removeEventListener('load', syncFrames, true); bridge.destroy(); } });
    }
  }

  findEditor(target) {
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      const cm = leaf.view.editor?.cm;
      if (cm?.contentDOM?.contains(target)) return cm;
    }
    for (const canvas of this.bridges.keys()) {
      for (const node of canvas.nodes.values()) {
        const cm = node.child?.editor?.cm;
        if (node.isEditing && cm?.contentDOM?.contains(target)) return cm;
      }
    }
    return null;
  }

  onunload() {
    for (const entry of this.textDocuments.values()) entry.destroy();
    this.textDocuments.clear();
    for (const bridge of this.bridges.values()) bridge.destroy();
    this.bridges.clear();
  }
};

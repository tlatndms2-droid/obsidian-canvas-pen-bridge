'use strict';
const { Plugin } = require('obsidian');
const { PenBridge } = require('./pen-bridge');

module.exports = class CanvasPenBridge extends Plugin {
  onload() {
    this.bridges = new Map();
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
  }

  onunload() {
    for (const bridge of this.bridges.values()) bridge.destroy();
    this.bridges.clear();
  }
};

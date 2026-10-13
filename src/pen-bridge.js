'use strict';

const EXCLUDED = '.cdt-toolbar,.cdt-panel,.cdt-layers,.cdt-panel-edge,.cdt-color-popup,.cdt-history,.cdt-anchors,.cdt-selection-bar,.cdt-save-warning,.canvas-controls,.canvas-menu,.canvas-card-menu,button,input,textarea,select,[contenteditable="true"],.markdown-source-view';

class PenBridge {
  constructor(canvas) {
    this.canvas = canvas;
    this.host = canvas.wrapperEl;
    this.doc = this.host.ownerDocument;
    this.win = this.doc.defaultView;
    this.listeners = [];
    this.gesture = null;
    this.navigationEndedId = null;
    this.suppressContextUntil = 0;
    this.listen(this.doc, 'pointerover', e => {
      if (this.inside(e.target)) {
        this.host.classList.toggle('cpb-pen-input', e.pointerType === 'pen');
      }
    }, true);
    this.listen(this.doc, 'pointerdown', e => this.down(e), true);
    this.listen(this.win, 'pointermove', e => this.move(e), true);
    this.listen(this.win, 'pointerup', e => this.up(e), true);
    this.listen(this.win, 'pointercancel', e => this.up(e), true);
    this.listen(this.host, 'lostpointercapture', e => {
      if (this.gesture?.id === e.pointerId) this.cancel();
    });
    this.listen(this.win, 'blur', () => this.cancel());
    this.listen(this.win, 'keydown', e => {
      if (e.key === 'Escape') this.cancel();
    });
    this.listen(this.doc, 'contextmenu', e => {
      if (this.inside(e.target) && !e.target.closest(EXCLUDED)
        && ((this.gesture?.mode === 'pan' || this.gesture?.mode === 'zoom') && this.gesture.active
          || this.navigationEndedId !== null
          || Date.now() < this.suppressContextUntil)) this.stop(e);
    }, true);
  }

  listen(target, type, fn, capture = false) {
    target.addEventListener(type, fn, capture);
    this.listeners.push(() => target.removeEventListener(type, fn, capture));
  }

  inside(target) {
    return !!target && typeof target.nodeType === 'number' && this.host.contains(target);
  }

  eligible(e) {
    // Never change drawing events, pressure, or inputs outside this Canvas.
    return e.pointerType === 'pen' && !this.canvas.readonly
      && !this.host.classList.contains('cdt-drawing')
      && this.inside(e.target) && typeof e.target.closest === 'function'
      && !e.target.closest(EXCLUDED);
  }

  stop(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  down(e) {
    if (!this.eligible(e) || this.gesture) return;
    if (e.button === 2) return this.startNavigation(e);
    if (e.button !== 0 || e.defaultPrevented) return;
    const card = e.target.closest('.canvas-node');
    const handle = e.target.closest('.canvas-node-resizer,.canvas-node-connection-point');
    const edgeHit = e.target.closest('.canvas-interaction-path,.canvas-path-end');
    const edge = edgeHit && [...this.canvas.edges.values()].find(edge =>
      edge.lineGroupEl?.contains(e.target) || edge.lineEndGroupEl?.contains(e.target));
    const background = e.target === this.host;
    const selectionLayer = this.canvas.menu?.selection?.selectionEl;
    const selectionHit = !!selectionLayer?.contains(e.target);
    // Preserve native text editing, links and non-card interactions.
    if (!background && !selectionHit && !edge && !e.target.closest('.canvas-node-container,.canvas-node-resizer,.canvas-node-connection-point,.canvas-group-label')) return;
    const layer = this.canvas.nodeInteractionLayer;
    const node = card ? [...this.canvas.nodes.values()].find(n => n.nodeEl === card)
      : handle && layer?.interactionEl?.contains(e.target) ? layer.target : null;
    if (!background && !selectionHit && !edge && (!node || (!handle && node.isEditing))) return;
    this.stop(e);
    this.gesture = { id: e.pointerId, mode: 'card', target: e.target };
    // Only the drag start is adapted. Native Canvas continues to receive the
    // original pen moves/up/cancel with the same pointerId and native pressure.
    const start = new this.win.PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, composed: true, view: this.win,
      pointerId: e.pointerId, pointerType: 'mouse', isPrimary: true,
      button: e.button, buttons: e.buttons,
      clientX: e.clientX, clientY: e.clientY,
      screenX: e.screenX, screenY: e.screenY,
      ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey
    });
    // Arrowheads are rendered in a separate SVG group. The native reconnect
    // listener lives on the interaction path, so route endpoint starts there.
    const replayTarget = edge?.path?.interaction || e.target;
    replayTarget.dispatchEvent(start);
  }

  startNavigation(e) {
    if (!this.eligible(e) || this.gesture) return;
    const mode = e.ctrlKey ? 'zoom' : 'pan';
    this.gesture = {
      id: e.pointerId, mode, active: false, startX: e.clientX, startY: e.clientY,
      x: e.clientX, y: e.clientY,
      zoom: this.canvas.tZoom, center: this.canvas.domPosFromEvt(e)
    };
  }

  move(e) {
    // Hover may be delivered as pointermove without a new pointerover after
    // implicit capture. Refresh pen mode before the next contact begins.
    if (e.pointerType === 'pen' && this.inside(e.target)) {
      this.host.classList.toggle('cpb-pen-input', true);
    }
    if (this.navigationEndedId === e.pointerId) {
      if (e.buttons & 2) this.stop(e);
      else this.navigationEndedId = null;
      return;
    }
    // Pen side buttons can begin during hover/contact as pointermove rather
    // than pointerdown. Start only when no card gesture is already active.
    if (!this.gesture && (e.buttons & 2) && this.eligible(e)) this.startNavigation(e);
    const g = this.gesture;
    if (!g || g.id !== e.pointerId || g.mode === 'card') return;
    if (!(e.buttons & 2)) return this.finish();
    if (!!e.ctrlKey !== (g.mode === 'zoom') || this.host.classList.contains('cdt-drawing')) {
      this.navigationEndedId = e.pointerId;
      return this.finish();
    }
    if (!g.active) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 5) return;
      g.active = true;
      try { this.host.setPointerCapture(e.pointerId); } catch (_) { /* Synthetic test or ended contact. */ }
    }
    this.stop(e);
    if (g.mode === 'zoom') {
      this.canvas.zoomBy(g.zoom + (e.clientX - g.x) / 200 - this.canvas.tZoom, g.center);
      this.canvas.finishViewportAnimation = true;
    } else {
      this.canvas.panBy(-(e.clientX - g.x) / this.canvas.scale, -(e.clientY - g.y) / this.canvas.scale);
      g.x = e.clientX;
      g.y = e.clientY;
    }
  }

  up(e) {
    if (this.navigationEndedId === e.pointerId) {
      this.navigationEndedId = null;
      this.stop(e);
      return;
    }
    if (this.gesture?.id !== e.pointerId) return;
    if (this.gesture.mode !== 'card' && this.gesture.active) this.stop(e);
    // Native Canvas must receive the unmodified pen release/cancellation.
    this.finish();
  }

  finish() {
    const g = this.gesture;
    this.gesture = null;
    if (!g) return;
    if (g.mode !== 'card' && g.active) {
      this.suppressContextUntil = Date.now() + 150;
      try { if (this.host.hasPointerCapture(g.id)) this.host.releasePointerCapture(g.id); } catch (_) { /* Window closed. */ }
    }
  }

  cancel() {
    const g = this.gesture;
    this.finish();
    if (g?.mode === 'card') {
      // Abort the native drag on blur/unload so Canvas can restore its own
      // pre-drag positions and remove its document listeners.
      this.win.dispatchEvent(new this.win.PointerEvent('pointercancel', {
        pointerId: g.id, pointerType: 'pen', isPrimary: true, view: this.win
      }));
    }
  }

  destroy() {
    this.cancel();
    this.navigationEndedId = null;
    this.host.classList.remove('cpb-pen-input');
    for (const remove of this.listeners.splice(0)) remove();
  }
}

module.exports = { PenBridge };

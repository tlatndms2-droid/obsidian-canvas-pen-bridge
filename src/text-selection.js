'use strict';

// Text selection is separate from Canvas dragging: it never changes document text.
class PenTextSelection {
  constructor(doc, resolveEditor) {
    this.doc = doc;
    this.win = doc.defaultView;
    this.resolveEditor = resolveEditor;
    this.listeners = [];
    this.marked = new Map();
    this.gesture = null;
    this.savedSelection = null;
    this.contextSelection = null;
    this.listen(doc, 'pointerover', e => this.hover(e), true);
    this.listen(doc, 'pointerdown', e => this.down(e), true);
    this.listen(doc, 'mousedown', e => {
      if (e.button === 2 && this.contextSelection && this.area(e)?.root === this.contextSelection.root) {
        this.restore(this.contextSelection);
        this.stop(e);
      }
    }, true);
    this.listen(doc, 'contextmenu', e => {
      const area = this.area(e);
      const saved = this.contextSelection;
      if (!area || !saved || saved.root !== area.root) return;
      this.restore(saved);
      // Keep the native menu and its copy actions; only preserve selection.
      this.win.queueMicrotask(() => this.restore(saved));
      this.contextSelection = null;
    }, true);
    this.listen(this.win, 'pointermove', e => this.move(e), true);
    this.listen(this.win, 'pointerup', e => this.end(e), true);
    this.listen(this.win, 'pointercancel', e => this.end(e), true);
    this.listen(doc, 'lostpointercapture', e => {
      const g = this.gesture;
      // Moving implicit capture from a text span to the editor is not release.
      if (g?.id === e.pointerId && e.target === g.root && !g.root.hasPointerCapture(g.id)) this.finish();
    }, true);
    this.listen(this.win, 'blur', e => { if (e.target === this.win) this.finish(); });
    this.listen(doc, 'keydown', e => { if (e.key === 'Escape') this.finish(); }, true);
  }

  listen(target, type, fn, capture = false) {
    target.addEventListener(type, fn, capture);
    this.listeners.push(() => target.removeEventListener(type, fn, capture));
  }

  area(e) {
    const target = e.target;
    if (!target?.closest || target.closest('.cdt-drawing,button,input,textarea,select,a,.metadata-container')) return null;
    const editor = this.resolveEditor(target);
    if (editor?.contentDOM?.contains(target)) return { root: editor.contentDOM, scroll: editor.scrollDOM, editor };
    const preview = target.closest('.markdown-preview-view');
    // Canvas reading cards still use their normal body drag. Enter editing first.
    if (preview && !target.closest('.canvas-node')) return { root: preview, scroll: preview };
    return null;
  }

  hover(e) {
    const area = this.area(e);
    if (!area) return;
    if (e.pointerType === 'pen') {
      if (!this.marked.has(area.scroll)) this.marked.set(area.scroll, area.scroll.style.touchAction);
      area.scroll.style.touchAction = 'none';
    } else if (this.marked.has(area.scroll)) {
      area.scroll.style.touchAction = this.marked.get(area.scroll);
      this.marked.delete(area.scroll);
    }
  }

  caret(root, x, y) {
    const pos = this.doc.caretPositionFromPoint?.(x, y);
    const range = !pos && this.doc.caretRangeFromPoint?.(x, y);
    const node = pos?.offsetNode || range?.startContainer;
    const offset = pos?.offset ?? range?.startOffset;
    return node && root.contains(node) ? { node, offset } : null;
  }

  stop(e) { e.preventDefault(); e.stopImmediatePropagation(); }

  snapshot(area) {
    if (area.editor) {
      const selection = area.editor.state.selection.main;
      if (selection.from === selection.to) return null;
      return { ...area, selection: { anchor: selection.anchor, head: selection.head }, doc: area.editor.state.doc };
    }
    const selection = this.doc.getSelection();
    if (!selection || selection.isCollapsed || !area.root.contains(selection.anchorNode)
      || !area.root.contains(selection.focusNode)) return null;
    return { ...area, anchorNode: selection.anchorNode, anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode, focusOffset: selection.focusOffset };
  }

  restore(saved) {
    if (saved.editor) {
      if (saved.editor.state.doc === saved.doc) saved.editor.dispatch({ selection: saved.selection });
    } else if (saved.root.contains(saved.anchorNode) && saved.root.contains(saved.focusNode)) {
      this.doc.getSelection().setBaseAndExtent(saved.anchorNode, saved.anchorOffset, saved.focusNode, saved.focusOffset);
    }
  }

  down(e) {
    if (e.pointerType !== 'pen') return;
    const area = this.area(e);
    if (!area) return;
    if (e.button === 2) {
      const saved = this.snapshot(area) || (this.savedSelection?.root === area.root
        && Date.now() - this.savedSelection.time < 1000 ? this.savedSelection : null);
      if (saved) {
        this.contextSelection = saved;
        this.restore(saved);
        this.stop(e);
        this.finish();
      }
      return;
    }
    if (e.button !== 0 || this.gesture) return;
    this.contextSelection = null;
    const anchor = area.editor ? area.editor.posAtCoords({ x: e.clientX, y: e.clientY })
      : this.caret(area.root, e.clientX, e.clientY);
    if (anchor === null) return;
    this.hover(e);
    this.stop(e);
    // Focus may blur the previously active card/frame. Do this before creating
    // the gesture so that focus transfer cannot cancel the new drag.
    if (area.editor) area.editor.focus();
    this.gesture = { ...area, id: e.pointerId, anchor };
    if (area.editor) {
      if (e.shiftKey) this.gesture.anchor = area.editor.state.selection.main.anchor;
      area.editor.dispatch({ selection: { anchor: this.gesture.anchor, head: anchor } });
    } else {
      this.doc.getSelection().setBaseAndExtent(anchor.node, anchor.offset, anchor.node, anchor.offset);
    }
    try { area.root.setPointerCapture(e.pointerId); } catch (_) { /* Synthetic input. */ }
  }

  move(e) {
    const g = this.gesture;
    if (!g || g.id !== e.pointerId) return;
    if (!(e.buttons & 1)) return this.finish();
    this.stop(e);
    const rect = g.scroll.getBoundingClientRect();
    if (e.clientY < rect.top || e.clientY > rect.bottom) {
      g.scroll.scrollBy(0, e.clientY < rect.top ? -20 : 20);
    }
    const x = Math.max(rect.left + 1, Math.min(rect.right - 1, e.clientX));
    const y = Math.max(rect.top + 1, Math.min(rect.bottom - 1, e.clientY));
    if (g.editor) {
      const head = g.editor.posAtCoords({ x, y });
      if (head !== null) g.editor.dispatch({ selection: { anchor: g.anchor, head } });
    } else {
      const head = this.caret(g.root, x, y);
      if (head) this.doc.getSelection().setBaseAndExtent(g.anchor.node, g.anchor.offset, head.node, head.offset);
    }
  }

  end(e) {
    if (this.gesture?.id !== e.pointerId) return;
    this.stop(e);
    this.finish();
  }

  finish() {
    const g = this.gesture;
    this.gesture = null;
    if (g) {
      const saved = this.snapshot(g);
      if (saved) this.savedSelection = { ...saved, time: Date.now() };
    }
    try { if (g?.root.hasPointerCapture(g.id)) g.root.releasePointerCapture(g.id); } catch (_) { /* Closed frame. */ }
  }

  destroy() {
    this.finish();
    for (const [el, value] of this.marked) el.style.touchAction = value;
    this.marked.clear();
    for (const remove of this.listeners.splice(0)) remove();
  }
}

module.exports = { PenTextSelection };

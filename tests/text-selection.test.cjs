'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PenTextSelection } = require('../src/text-selection');

function fixture() {
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.defaultView = win;
  const root = new EventTarget();
  root.closest = () => null;
  root.contains = target => target === root;
  root.style = { touchAction: 'pan-y' };
  root.getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, bottom: 100 });
  root.scrollBy = () => {};
  root.setPointerCapture = id => { root.capture = id; };
  root.hasPointerCapture = id => root.capture === id;
  root.releasePointerCapture = () => { root.capture = null; };
  const selections = [];
  const cm = { contentDOM: root, scrollDOM: root, focus() {}, state: { selection: { main: { anchor: 3 } } },
    posAtCoords: ({ x }) => Math.round(x), dispatch: update => selections.push(update.selection) };
  const bridge = new PenTextSelection(doc, () => cm);
  const event = (opts = {}) => ({ pointerType: 'pen', button: 0, buttons: 1, pointerId: 8,
    target: root, clientX: 10, clientY: 20, preventDefault() { this.stopped = true; }, stopImmediatePropagation() {}, ...opts });
  return { bridge, root, win, doc, selections, event };
}

test('editor focus changes during pen down must not end the new selection', () => {
  const f = fixture();
  f.bridge.resolveEditor(f.root).focus = () => f.win.dispatchEvent(new Event('blur'));
  f.bridge.down(f.event());
  f.bridge.move(f.event({ clientX: 70 }));
  assert.deepEqual(f.selections.at(-1), { anchor: 10, head: 70 });
  f.bridge.destroy();
});

test('pen right click preserves a nonempty editor selection and leaves the native menu available', () => {
  const f = fixture();
  const cm = f.bridge.resolveEditor(f.root);
  cm.state.doc = {};
  cm.state.selection.main = { anchor: 10, head: 70, from: 10, to: 70 };
  const right = f.event({ button: 2, buttons: 2 });
  f.bridge.down(right);
  assert.equal(right.stopped, true);
  assert.deepEqual(f.selections, [{ anchor: 10, head: 70 }]);
  assert.ok(f.bridge.contextSelection);
  assert.equal(f.bridge.gesture, null);
  cm.state.doc = {}; // Never restore positions into a changed document.
  f.bridge.restore(f.bridge.contextSelection);
  assert.equal(f.selections.length, 1);
  f.bridge.destroy();
});

test('nonprimary pen extends the editor selection without changing document content', () => {
  const f = fixture();
  const down = f.event({ isPrimary: false });
  f.bridge.down(down);
  f.bridge.move(f.event({ clientX: 70 }));
  assert.deepEqual(f.selections, [{ anchor: 10, head: 10 }, { anchor: 10, head: 70 }]);
  assert.equal(down.stopped, true);
  f.bridge.end(f.event({ buttons: 0 }));
  assert.equal(f.bridge.gesture, null);
  assert.equal(f.root.capture, null);
  f.bridge.destroy();
  assert.equal(f.root.style.touchAction, 'pan-y');
});

test('mouse touch right click and excluded controls keep native handling', () => {
  for (const options of [{ pointerType: 'mouse' }, { pointerType: 'touch' }, { button: 2 }]) {
    const f = fixture();
    const e = f.event(options);
    f.bridge.down(e);
    assert.equal(f.selections.length, 0);
    assert.equal(e.stopped, undefined);
    f.bridge.destroy();
  }
  const f = fixture();
  f.root.closest = () => f.root;
  f.bridge.down(f.event());
  assert.equal(f.selections.length, 0);
  f.bridge.destroy();
});

test('Shift extends selection and other pointers cannot replace or end it', () => {
  const f = fixture();
  f.bridge.down(f.event({ shiftKey: true }));
  f.bridge.move(f.event({ pointerId: 9, clientX: 80 }));
  f.bridge.end(f.event({ pointerId: 9 }));
  assert.deepEqual(f.selections, [{ anchor: 3, head: 10 }]);
  assert.equal(f.bridge.gesture.id, 8);
  f.bridge.finish();
  assert.equal(f.bridge.gesture, null);
  f.bridge.destroy();
  assert.equal(f.bridge.listeners.length, 0);
});

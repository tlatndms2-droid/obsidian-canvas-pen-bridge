'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PenBridge } = require('../src/pen-bridge');

class Pointer extends Event {
  constructor(type, options = {}) {
    super(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries(options)) {
      Object.defineProperty(this, key, { value, configurable: true });
    }
  }
}

function fixture() {
  const win = new EventTarget();
  win.PointerEvent = Pointer;
  const doc = new EventTarget();
  doc.defaultView = win;
  const card = {};
  const element = new EventTarget();
  element.nodeType = 1;
  element.closest = selector => selector === '.canvas-node' ? card
    : selector.startsWith('.canvas-node-container') ? element : null;
  const host = new EventTarget();
  host.nodeType = 1;
  host.ownerDocument = doc;
  host.drawing = false;
  const classes = new Set();
  host.classList = {
    contains: name => name === 'cdt-drawing' ? host.drawing : classes.has(name),
    toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
    remove: name => classes.delete(name)
  };
  host.contains = target => target === element || target === host;
  host.closest = () => null;
  host.setPointerCapture = id => { host.capture = id; };
  host.hasPointerCapture = id => host.capture === id;
  host.releasePointerCapture = () => { host.capture = null; };
  const calls = [];
  const canvas = {
    wrapperEl: host, nodes: new Map([['a', { nodeEl: card, isEditing: false }]]),
    edges: new Map(),
    readonly: false, scale: 2, tZoom: 0,
    domPosFromEvt: e => ({ x: e.clientX, y: e.clientY }),
    panBy: (...args) => calls.push(['pan', ...args]),
    zoomBy: (...args) => calls.push(['zoom', ...args])
  };
  const bridge = new PenBridge(canvas);
  const events = [];
  element.addEventListener('pointerdown', e => events.push(e));
  const event = (options = {}) => new Pointer('pointerdown', {
    pointerType: 'pen', pointerId: 12, isPrimary: false,
    button: 0, buttons: 1, pressure: 0.72,
    clientX: 100, clientY: 100, ctrlKey: false, target: element,
    ...options
  });
  return { bridge, canvas, host, element, doc, win, calls, events, event };
}

test('pen hover marks only this Canvas and mouse/touch hover and unload clear it', () => {
  const f = fixture();
  const hover = pointerType => f.doc.dispatchEvent(new Pointer('pointerover', { pointerType, target: f.element }));
  hover('pen');
  assert.equal(f.host.classList.contains('cpb-pen-input'), true);
  hover('mouse');
  assert.equal(f.host.classList.contains('cpb-pen-input'), false);
  hover('pen');
  hover('touch');
  assert.equal(f.host.classList.contains('cpb-pen-input'), false);
  hover('pen');
  f.bridge.destroy();
  assert.equal(f.host.classList.contains('cpb-pen-input'), false);
});

test('non-primary pen starts one native mouse-compatible drag without modifying pen pressure', () => {
  const f = fixture();
  const pen = f.event();
  f.bridge.down(pen);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].pointerType, 'mouse');
  assert.equal(f.events[0].isPrimary, true);
  assert.equal(f.events[0].pointerId, pen.pointerId);
  assert.equal(pen.pointerType, 'pen');
  assert.equal(pen.pressure, 0.72);
  assert.equal(pen.defaultPrevented, true);
  f.bridge.destroy();
});

test('drawing, mouse, touch, readonly and editing input remain untouched', () => {
  for (const mode of ['drawing', 'mouse', 'touch', 'readonly', 'editing']) {
    const f = fixture();
    if (mode === 'drawing') f.host.drawing = true;
    if (mode === 'readonly') f.canvas.readonly = true;
    if (mode === 'editing') f.canvas.nodes.get('a').isEditing = true;
    const e = f.event(['mouse', 'touch'].includes(mode) ? { pointerType: mode } : {});
    f.bridge.down(e);
    assert.equal(f.events.length, 0, mode);
    assert.equal(e.defaultPrevented, false, mode);
    f.bridge.destroy();
  }
});

test('toolbar controls and events outside the Canvas are excluded', () => {
  const f = fixture();
  const outside = f.event({ target: { closest: () => null } });
  f.bridge.down(outside);
  assert.equal(outside.defaultPrevented, false);
  f.element.closest = () => f.element;
  const control = f.event();
  f.bridge.down(control);
  assert.equal(control.defaultPrevented, false);
  f.bridge.destroy();
});

test('original card moves and releases are not replaced or stopped', () => {
  const f = fixture();
  f.bridge.down(f.event());
  const move = f.event({ clientX: 150 });
  f.bridge.move(move);
  assert.equal(move.defaultPrevented, false);
  const up = f.event({ buttons: 0 });
  f.bridge.up(up);
  assert.equal(up.defaultPrevented, false);
  assert.equal(f.bridge.gesture, null);
  f.bridge.destroy();
});

test('blank Canvas pen click reaches the native deselect/edit-exit handler', () => {
  const f = fixture();
  const starts = [];
  f.host.addEventListener('pointerdown', e => starts.push(e));
  f.bridge.down(f.event({ target: f.host }));
  assert.equal(starts.length, 1);
  assert.equal(starts[0].pointerType, 'mouse');
  assert.equal(starts[0].isPrimary, true);
  f.bridge.up(f.event({ target: f.host, buttons: 0 }));
  assert.equal(f.bridge.gesture, null);
  f.bridge.destroy();
});

test('selected group and multi-selection background reach the native selection drag handler', () => {
  const f = fixture();
  f.element.closest = () => null;
  f.canvas.menu = { selection: { selectionEl: { contains: e => e === f.element } } };
  const pen = f.event();
  f.bridge.down(pen);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].pointerType, 'mouse');
  assert.equal(f.events[0].isPrimary, true);
  assert.equal(pen.defaultPrevented, true);
  f.bridge.destroy();
});

test('resize and connection handles in the separate interaction layer are adapted', () => {
  const f = fixture();
  f.element.closest = selector => selector.startsWith('.canvas-node-container')
    || selector === '.canvas-node-resizer,.canvas-node-connection-point' ? f.element : null;
  f.canvas.nodeInteractionLayer = {
    interactionEl: { contains: e => e === f.element }, target: f.canvas.nodes.get('a')
  };
  f.canvas.nodes.get('a').isEditing = true;
  f.bridge.down(f.event());
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].isPrimary, true);
  f.bridge.destroy();
});

test('existing edge endpoint and interaction path drags are adapted', () => {
  const f = fixture();
  f.element.closest = selector => selector === '.canvas-interaction-path,.canvas-path-end' ? f.element : null;
  f.canvas.edges.set('edge', { lineEndGroupEl: { contains: e => e === f.element } });
  f.bridge.down(f.event());
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].pointerId, 12);
  f.bridge.destroy();
});

test('arrowhead starts are routed to the native edge interaction path', () => {
  const f = fixture();
  const path = new EventTarget();
  const routed = [];
  path.addEventListener('pointerdown', e => routed.push(e));
  f.element.closest = selector => selector === '.canvas-interaction-path,.canvas-path-end' ? f.element : null;
  f.canvas.edges.set('edge', {
    lineEndGroupEl: { contains: e => e === f.element }, path: { interaction: path }
  });
  f.bridge.down(f.event());
  assert.equal(f.events.length, 0);
  assert.equal(routed.length, 1);
  assert.equal(routed[0].pointerId, 12);
  assert.equal(routed[0].isPrimary, true);
  f.bridge.destroy();
});

test('pen hover moves refresh the pen marker after implicit capture', () => {
  const f = fixture();
  f.bridge.move(f.event({ buttons: 0 }));
  assert.equal(f.host.classList.contains('cpb-pen-input'), true);
  assert.equal(f.bridge.gesture, null);
  f.bridge.destroy();
});

test('window-targeted moves never call DOM contains on a Window', () => {
  const f = fixture();
  assert.doesNotThrow(() => f.bridge.move(f.event({ target: f.win, buttons: 0 })));
  f.bridge.destroy();
});

test('a second pointer cannot replace the active card gesture', () => {
  const f = fixture();
  f.bridge.down(f.event());
  f.bridge.down(f.event({ pointerId: 13 }));
  f.bridge.up(f.event({ pointerId: 13 }));
  assert.equal(f.events.length, 1);
  assert.equal(f.bridge.gesture.id, 12);
  f.bridge.destroy();
});

test('blur and unload cancel a native card gesture and remove listeners', () => {
  const f = fixture();
  const cancelled = [];
  f.win.addEventListener('pointercancel', e => cancelled.push(e.pointerId));
  f.bridge.down(f.event());
  f.win.dispatchEvent(new Event('blur'));
  assert.deepEqual(cancelled, [12]);
  assert.equal(f.bridge.gesture, null);
  f.bridge.down(f.event());
  f.bridge.destroy();
  assert.deepEqual(cancelled, [12, 12]);
  assert.equal(f.bridge.listeners.length, 0);
});

test('right pen drag pans and Ctrl right drag matches toolbar zoom direction and sensitivity', () => {
  const f = fixture();
  f.bridge.down(f.event({ button: 2, buttons: 2 }));
  f.bridge.move(f.event({ buttons: 2, clientX: 140, clientY: 120 }));
  assert.deepEqual(f.calls, [['pan', -20, -10]]);
  f.bridge.up(f.event({ buttons: 0 }));
  assert.equal(f.host.capture, null);
  f.bridge.down(f.event({ button: 2, buttons: 2, ctrlKey: true }));
  f.bridge.move(f.event({ buttons: 2, ctrlKey: true, clientX: 140 }));
  assert.equal(f.calls[1][0], 'zoom');
  assert.equal(f.calls[1][1], 0.2);
  f.bridge.destroy();
});

test('single right pen click leaves the native context menu and release untouched', () => {
  const f = fixture();
  const down = f.event({ button: 2, buttons: 2 });
  f.bridge.down(down);
  assert.equal(down.defaultPrevented, false);
  const slight = f.event({ buttons: 2, clientX: 102, clientY: 101 });
  f.bridge.move(slight);
  assert.equal(slight.defaultPrevented, false);
  assert.equal(f.calls.length, 0);
  const menu = new Pointer('contextmenu', { target: f.element });
  f.doc.dispatchEvent(menu);
  assert.equal(menu.defaultPrevented, false);
  const up = f.event({ button: 2, buttons: 0 });
  f.bridge.up(up);
  assert.equal(up.defaultPrevented, false);
  assert.equal(f.bridge.suppressContextUntil, 0);
  f.bridge.destroy();
});

test('actual right drag suppresses its context menu after movement', () => {
  const f = fixture();
  f.bridge.down(f.event({ button: 2, buttons: 2 }));
  f.bridge.move(f.event({ buttons: 2, clientX: 120 }));
  const menu = new Pointer('contextmenu', { target: f.element });
  f.doc.dispatchEvent(menu);
  assert.equal(menu.defaultPrevented, true);
  f.bridge.up(f.event({ button: 2, buttons: 0 }));
  assert.ok(f.bridge.suppressContextUntil > Date.now());
  f.bridge.destroy();
});

test('navigation ends on modifier change and leaves normal drawing navigation alone', () => {
  const f = fixture();
  f.bridge.down(f.event({ button: 2, buttons: 2 }));
  f.bridge.move(f.event({ buttons: 2, ctrlKey: true, clientX: 150 }));
  assert.equal(f.bridge.gesture, null);
  assert.equal(f.calls.length, 0);
  f.bridge.move(f.event({ buttons: 2, ctrlKey: true, clientX: 180 }));
  assert.equal(f.bridge.gesture, null);
  assert.equal(f.calls.length, 0);
  f.bridge.up(f.event({ buttons: 0 }));
  f.host.drawing = true;
  const drawing = f.event({ button: 2, buttons: 2 });
  f.bridge.down(drawing);
  assert.equal(drawing.defaultPrevented, false);
  f.bridge.destroy();
});

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");

const { GlobalPushToTalk } = require("../globalPushToTalk");
const { createKeymap } = require("../keymap");

// A few of uiohook-napi's scancodes, enough to exercise the keymap
const UiohookKey = { Space: 0x39, T: 0x14, 5: 0x06, F13: 0x5b, Ctrl: 0x1d };

test("reports the bound key going down and up, once each", () => {
  const { hook, changes, ptt } = setup();
  ptt.configure({ enabled: true, binding: { type: "keyboard", code: "KeyT" } });
  assert.equal(hook.running, true);

  hook.emit("keydown", { keycode: UiohookKey.T });
  hook.emit("keydown", { keycode: UiohookKey.T }); // auto-repeat
  hook.emit("keydown", { keycode: UiohookKey.Space });
  hook.emit("keyup", { keycode: UiohookKey.T });
  assert.deepEqual(changes, [true, false]);
});

test("hears mouse side buttons in libuiohook's numbering", () => {
  const { hook, changes, ptt } = setup();
  ptt.configure({ enabled: true, binding: { type: "mouse", button: 3 } });
  hook.emit("mousedown", { button: 3 }); // uiohook's middle button
  hook.emit("mousedown", { button: 4 });
  hook.emit("mouseup", { button: 4 });
  assert.deepEqual(changes, [true, false]);
});

test("translates modifiers, digits and function keys", () => {
  const { uiohookKeycodeFor } = createKeymap(UiohookKey);
  assert.equal(uiohookKeycodeFor("ControlLeft"), UiohookKey.Ctrl);
  assert.equal(uiohookKeycodeFor("Digit5"), UiohookKey[5]);
  assert.equal(uiohookKeycodeFor("F13"), UiohookKey.F13);
  assert.equal(uiohookKeycodeFor("IntlRo"), null);
  assert.equal(uiohookKeycodeFor("constructor"), null);
});

test("stops the hook when disabled, releasing a held key", () => {
  const { hook, changes, ptt } = setup();
  ptt.configure({
    enabled: true,
    binding: { type: "keyboard", code: "Space" },
  });
  hook.emit("keydown", { keycode: UiohookKey.Space });
  ptt.configure({
    enabled: false,
    binding: { type: "keyboard", code: "Space" },
  });
  assert.equal(hook.running, false);
  assert.equal(hook.listenerCount("keydown"), 0);
  assert.deepEqual(changes, [true, false]);
});

test("rebinding releases the old key and listens for the new one", () => {
  const { hook, changes, ptt } = setup();
  ptt.configure({
    enabled: true,
    binding: { type: "keyboard", code: "Space" },
  });
  hook.emit("keydown", { keycode: UiohookKey.Space });
  ptt.configure({ enabled: true, binding: { type: "keyboard", code: "KeyT" } });
  hook.emit("keydown", { keycode: UiohookKey.T });
  assert.deepEqual(changes, [true, false, true]);
  assert.equal(hook.starts, 1);
});

test("never runs the hook for a binding it cannot hear", () => {
  const { hook, ptt } = setup();
  ptt.configure({
    enabled: true,
    binding: { type: "keyboard", code: "Lang1" },
  });
  assert.equal(hook.running, false);
});

test("survives the hook failing to start", () => {
  const { hook, ptt } = setup();
  hook.start = () => {
    throw new Error("not trusted for accessibility");
  };
  ptt.configure({
    enabled: true,
    binding: { type: "keyboard", code: "Space" },
  });
  assert.equal(hook.listenerCount("keydown"), 0);
});

function setup() {
  const hook = new FakeHook();
  const changes = [];
  const ptt = new GlobalPushToTalk({
    hook,
    keymap: createKeymap(UiohookKey),
    onChange: (pressed) => changes.push(pressed),
  });
  return { hook, changes, ptt };
}

class FakeHook extends EventEmitter {
  running = false;
  starts = 0;
  start() {
    this.running = true;
    this.starts++;
  }
  stop() {
    this.running = false;
  }
}

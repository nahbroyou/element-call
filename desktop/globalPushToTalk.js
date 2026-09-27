/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * Listens system-wide for the push to talk binding, and reports it being
 * pressed and released.
 *
 * The input hook only runs while push to talk is enabled, so the app is not
 * watching the keyboard and mouse the rest of the time.
 */
class GlobalPushToTalk {
  /**
   * @param {object} deps
   * @param {import("events").EventEmitter & { start(): void; stop(): void }} deps.hook
   *   uiohook-napi's `uIOhook`
   * @param {ReturnType<import("./keymap").createKeymap>} deps.keymap
   * @param {(pressed: boolean) => void} deps.onChange
   * @param {(message: string, error?: unknown) => void} [deps.log]
   */
  constructor({ hook, keymap, onChange, log = () => {} }) {
    this.hook = hook;
    this.keymap = keymap;
    this.onChange = onChange;
    this.log = log;
    this.running = false;
    this.pressed = false;
    /** @type {{ type: "key", keycode: number } | { type: "mouse", button: number } | null} */
    this.target = null;

    this.onKeyDown = (e) => this.handle("key", e.keycode, true);
    this.onKeyUp = (e) => this.handle("key", e.keycode, false);
    this.onMouseDown = (e) => this.handle("mouse", e.button, true);
    this.onMouseUp = (e) => this.handle("mouse", e.button, false);
  }

  /**
   * @param {{ enabled: boolean, binding: { type: "keyboard", code: string } | { type: "mouse", button: number } }} config
   *   as sent by the page
   */
  configure({ enabled, binding }) {
    const target = enabled ? this.translate(binding) : null;
    if (sameTarget(target, this.target)) return;
    this.setPressed(false);
    this.target = target;
    if (target === null) this.stop();
    else this.start();
  }

  dispose() {
    this.configure({ enabled: false, binding: null });
  }

  translate(binding) {
    if (binding?.type === "keyboard") {
      const keycode = this.keymap.uiohookKeycodeFor(binding.code);
      if (keycode !== null) return { type: "key", keycode };
    } else if (binding?.type === "mouse") {
      const button = this.keymap.uiohookButtonFor(binding.button);
      if (button !== null) return { type: "mouse", button };
    }
    this.log(
      `Push to talk binding ${JSON.stringify(binding)} can't be heard system-wide`,
    );
    return null;
  }

  handle(type, value, pressed) {
    const target = this.target;
    if (target === null || target.type !== type) return;
    if ((type === "key" ? target.keycode : target.button) !== value) return;
    this.setPressed(pressed);
  }

  setPressed(pressed) {
    if (this.pressed === pressed) return;
    this.pressed = pressed;
    this.onChange(pressed);
  }

  start() {
    if (this.running) return;
    this.hook.on("keydown", this.onKeyDown);
    this.hook.on("keyup", this.onKeyUp);
    this.hook.on("mousedown", this.onMouseDown);
    this.hook.on("mouseup", this.onMouseUp);
    try {
      this.hook.start();
      this.running = true;
    } catch (e) {
      this.log("Could not start the system-wide input hook", e);
      this.removeListeners();
    }
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.removeListeners();
    try {
      this.hook.stop();
    } catch (e) {
      this.log("Could not stop the system-wide input hook", e);
    }
  }

  removeListeners() {
    this.hook.off("keydown", this.onKeyDown);
    this.hook.off("keyup", this.onKeyUp);
    this.hook.off("mousedown", this.onMouseDown);
    this.hook.off("mouseup", this.onMouseUp);
  }
}

function sameTarget(a, b) {
  if (a === null || b === null) return a === b;
  return a.type === b.type && a.keycode === b.keycode && a.button === b.button;
}

module.exports = { GlobalPushToTalk };

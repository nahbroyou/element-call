/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// Translates the page's push to talk binding (DOM `KeyboardEvent.code` /
// `MouseEvent.button`) into what libuiohook reports system-wide.

/**
 * @param {Record<string, number>} UiohookKey uiohook-napi's key table
 */
function createKeymap(UiohookKey) {
  /** DOM `code` → uiohook keycode, for codes whose names differ. */
  const renamed = {
    ControlLeft: UiohookKey.Ctrl,
    ControlRight: UiohookKey.CtrlRight,
    ShiftLeft: UiohookKey.Shift,
    ShiftRight: UiohookKey.ShiftRight,
    AltLeft: UiohookKey.Alt,
    AltRight: UiohookKey.AltRight,
    MetaLeft: UiohookKey.Meta,
    MetaRight: UiohookKey.MetaRight,
    OSLeft: UiohookKey.Meta,
    OSRight: UiohookKey.MetaRight,
  };

  /**
   * @param {string} code a `KeyboardEvent.code`
   * @returns {number | null}
   */
  function uiohookKeycodeFor(code) {
    if (Object.hasOwn(renamed, code)) return renamed[code];
    const letter = /^Key([A-Z])$/.exec(code);
    if (letter) return UiohookKey[letter[1]];
    const digit = /^Digit(\d)$/.exec(code);
    if (digit) return UiohookKey[digit[1]];
    return Object.hasOwn(UiohookKey, code) ? UiohookKey[code] : null;
  }

  return { uiohookKeycodeFor, uiohookButtonFor };
}

/** DOM `MouseEvent.button` → libuiohook's button numbering. */
const mouseButtons = {
  1: 3, // middle
  2: 2, // right
  3: 4, // back, what games call "Mouse 4"
  4: 5, // forward, "Mouse 5"
};

/**
 * @param {number} button a `MouseEvent.button`
 * @returns {number | null}
 */
function uiohookButtonFor(button) {
  return mouseButtons[button] ?? null;
}

module.exports = { createKeymap };

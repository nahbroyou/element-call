/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type { TFunction } from "i18next";

/**
 * The input the user holds down to talk.
 *
 * Keys are identified by `KeyboardEvent.code` (the physical key) rather than
 * `key`, so that the binding survives keyboard layout changes and modifiers.
 * Mouse buttons use `MouseEvent.button` numbering.
 */
export type PushToTalkBinding =
  | { type: "keyboard"; code: string }
  | { type: "mouse"; button: number };

export const defaultPushToTalkBinding: PushToTalkBinding = {
  type: "keyboard",
  code: "Space",
};

/** The primary mouse button is never bindable: it would stop clicks working. */
const PRIMARY_MOUSE_BUTTON = 0;

export function matchesKeyboardEvent(
  binding: PushToTalkBinding,
  event: KeyboardEvent,
): boolean {
  return binding.type === "keyboard" && binding.code === event.code;
}

export function matchesMouseEvent(
  binding: PushToTalkBinding,
  event: MouseEvent,
): boolean {
  return binding.type === "mouse" && binding.button === event.button;
}

export function bindingFromKeyboardEvent(
  event: KeyboardEvent,
): PushToTalkBinding | null {
  // `code` is empty for some virtual keys (e.g. IME composition)
  if (event.code === "" || event.code === "Unidentified") return null;
  return { type: "keyboard", code: event.code };
}

export function bindingFromMouseEvent(
  event: MouseEvent,
): PushToTalkBinding | null {
  if (event.button === PRIMARY_MOUSE_BUTTON) return null;
  return { type: "mouse", button: event.button };
}

export function isValidBinding(value: unknown): value is PushToTalkBinding {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v.type === "keyboard")
    return typeof v.code === "string" && v.code.length > 0;
  if (v.type === "mouse")
    return (
      typeof v.button === "number" &&
      Number.isInteger(v.button) &&
      v.button !== PRIMARY_MOUSE_BUTTON &&
      v.button >= 0
    );
  return false;
}

/**
 * Keys whose default action on a focused button is to press it. While one of
 * these is the binding, a focused button keeps the key for itself.
 */
export function activatesFocusedButton(binding: PushToTalkBinding): boolean {
  return (
    binding.type === "keyboard" &&
    (binding.code === "Space" ||
      binding.code === "Enter" ||
      binding.code === "NumpadEnter")
  );
}

/**
 * A human-readable name for the binding, e.g. "Space", "Left Ctrl", "F13",
 * "Mouse 4".
 */
export function describeBinding(
  binding: PushToTalkBinding,
  t: TFunction<"app", undefined>,
): string {
  if (binding.type === "mouse") {
    switch (binding.button) {
      case 1:
        return t("push_to_talk.binding.mouse_middle");
      case 2:
        return t("push_to_talk.binding.mouse_right");
      default:
        // Buttons 3 and 4 are what most mice and games call "Mouse 4" and
        // "Mouse 5"
        return t("push_to_talk.binding.mouse_numbered", {
          n: binding.button + 1,
        });
    }
  }
  return describeKeyCode(binding.code);
}

const namedCodes: Record<string, string> = {
  Space: "Space",
  ControlLeft: "Left Ctrl",
  ControlRight: "Right Ctrl",
  ShiftLeft: "Left Shift",
  ShiftRight: "Right Shift",
  AltLeft: "Left Alt",
  AltRight: "Right Alt",
  MetaLeft: "Left Meta",
  MetaRight: "Right Meta",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  CapsLock: "Caps Lock",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

function describeKeyCode(code: string): string {
  if (Object.hasOwn(namedCodes, code)) return namedCodes[code];
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1];
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) return digit[1];
  const numpad = /^Numpad(.+)$/.exec(code);
  if (numpad) return `Numpad ${numpad[1]}`;
  return code;
}

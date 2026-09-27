/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, test } from "vitest";
import type { TFunction } from "i18next";

import {
  activatesFocusedButton,
  bindingFromKeyboardEvent,
  bindingFromMouseEvent,
  describeBinding,
  isValidBinding,
  matchesKeyboardEvent,
  matchesMouseEvent,
} from "./binding";

describe("bindingFromKeyboardEvent", () => {
  test("uses the physical key", () => {
    expect(
      bindingFromKeyboardEvent(new KeyboardEvent("keydown", { code: "KeyT" })),
    ).toEqual({ type: "keyboard", code: "KeyT" });
  });

  test("accepts a lone modifier", () => {
    expect(
      bindingFromKeyboardEvent(
        new KeyboardEvent("keydown", { code: "ControlLeft", ctrlKey: true }),
      ),
    ).toEqual({ type: "keyboard", code: "ControlLeft" });
  });

  test("rejects keys without a physical code", () => {
    expect(
      bindingFromKeyboardEvent(new KeyboardEvent("keydown", { code: "" })),
    ).toBeNull();
  });
});

describe("bindingFromMouseEvent", () => {
  test.each([1, 2, 3, 4])("accepts button %i", (button) => {
    expect(
      bindingFromMouseEvent(new MouseEvent("mousedown", { button })),
    ).toEqual({ type: "mouse", button });
  });

  test("never takes the primary button", () => {
    expect(
      bindingFromMouseEvent(new MouseEvent("mousedown", { button: 0 })),
    ).toBeNull();
  });
});

test("matching keeps keyboard and mouse bindings apart", () => {
  const key = { type: "keyboard", code: "KeyV" } as const;
  const mouse = { type: "mouse", button: 3 } as const;
  expect(
    matchesKeyboardEvent(key, new KeyboardEvent("keydown", { code: "KeyV" })),
  ).toBe(true);
  expect(
    matchesKeyboardEvent(key, new KeyboardEvent("keydown", { code: "KeyB" })),
  ).toBe(false);
  expect(
    matchesKeyboardEvent(mouse, new KeyboardEvent("keydown", { code: "KeyV" })),
  ).toBe(false);
  expect(
    matchesMouseEvent(mouse, new MouseEvent("mousedown", { button: 3 })),
  ).toBe(true);
  expect(
    matchesMouseEvent(mouse, new MouseEvent("mousedown", { button: 4 })),
  ).toBe(false);
  expect(
    matchesMouseEvent(key, new MouseEvent("mousedown", { button: 3 })),
  ).toBe(false);
});

test.each([
  [{ type: "keyboard", code: "Space" }, true],
  [{ type: "mouse", button: 4 }, true],
  [{ type: "mouse", button: 0 }, false],
  [{ type: "mouse", button: 1.5 }, false],
  [{ type: "keyboard", code: "" }, false],
  [{ type: "gamepad", button: 1 }, false],
  ["Space", false],
  [null, false],
])("isValidBinding(%j) is %s", (value, valid) => {
  expect(isValidBinding(value)).toBe(valid);
});

test("only Space and Enter defer to a focused button", () => {
  expect(activatesFocusedButton({ type: "keyboard", code: "Space" })).toBe(
    true,
  );
  expect(activatesFocusedButton({ type: "keyboard", code: "Enter" })).toBe(
    true,
  );
  expect(activatesFocusedButton({ type: "keyboard", code: "KeyT" })).toBe(
    false,
  );
  expect(activatesFocusedButton({ type: "mouse", button: 3 })).toBe(false);
});

describe("describeBinding", () => {
  const t = ((key: string, options?: Record<string, unknown>): string =>
    options
      ? `${key} ${JSON.stringify(options)}`
      : key) as unknown as TFunction<"app", undefined>;

  test.each([
    ["Space", "Space"],
    ["KeyT", "T"],
    ["Digit5", "5"],
    ["ControlLeft", "Left Ctrl"],
    ["Numpad0", "Numpad 0"],
    ["F13", "F13"],
    ["Backquote", "`"],
  ])("names key %s as %s", (code, name) => {
    expect(describeBinding({ type: "keyboard", code }, t)).toBe(name);
  });

  test("numbers side mouse buttons the way games do", () => {
    expect(describeBinding({ type: "mouse", button: 3 }, t)).toBe(
      'push_to_talk.binding.mouse_numbered {"n":4}',
    );
    expect(describeBinding({ type: "mouse", button: 1 }, t)).toBe(
      "push_to_talk.binding.mouse_middle",
    );
  });
});

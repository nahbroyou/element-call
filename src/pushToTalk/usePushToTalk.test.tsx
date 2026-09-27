/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { act, fireEvent, render } from "@testing-library/react";
import { type FC } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { usePushToTalk } from "./usePushToTalk";
import {
  pushToTalkBinding,
  pushToTalkEnabled,
  pushToTalkReleaseDelayMs,
} from "../settings/settings";
import { defaultPushToTalkBinding, type PushToTalkBinding } from "./binding";
import { type DesktopBridge } from "./desktopBridge";

const RELEASE_DELAY = 100;

beforeEach(() => {
  vi.useFakeTimers();
  pushToTalkEnabled.setValue(true);
  pushToTalkBinding.setValue(defaultPushToTalkBinding);
  pushToTalkReleaseDelayMs.setValue(RELEASE_DELAY);
});

afterEach(() => {
  vi.useRealTimers();
  pushToTalkEnabled.setValue(false);
  delete window.elementCallDesktop;
});

test("starts the user muted", () => {
  const setAudioEnabled = vi.fn();
  render(<TestComponent setAudioEnabled={setAudioEnabled} />);
  expect(setAudioEnabled).toHaveBeenCalledExactlyOnceWith(false);
});

test("opens the microphone only while the key is held", () => {
  const setAudioEnabled = renderAndForgetInitialMute();

  fireEvent.keyDown(document.body, { code: "Space", key: " " });
  expect(setAudioEnabled).toHaveBeenLastCalledWith(true);

  fireEvent.keyUp(document.body, { code: "Space", key: " " });
  expect(setAudioEnabled).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(RELEASE_DELAY));
  expect(setAudioEnabled).toHaveBeenLastCalledWith(false);
  expect(setAudioEnabled).toHaveBeenCalledTimes(2);
});

test("answers to whatever key the user chose", () => {
  pushToTalkBinding.setValue({ type: "keyboard", code: "KeyT" });
  const setAudioEnabled = renderAndForgetInitialMute();

  fireEvent.keyDown(document.body, { code: "Space", key: " " });
  expect(setAudioEnabled).not.toHaveBeenCalled();

  fireEvent.keyDown(document.body, { code: "KeyT", key: "t" });
  expect(setAudioEnabled).toHaveBeenLastCalledWith(true);
});

test("ignores key repeat", () => {
  const setAudioEnabled = renderAndForgetInitialMute();
  fireEvent.keyDown(document.body, { code: "Space" });
  fireEvent.keyDown(document.body, { code: "Space", repeat: true });
  fireEvent.keyDown(document.body, { code: "Space", repeat: true });
  expect(setAudioEnabled).toHaveBeenCalledOnce();
});

test("pressing again during the release delay keeps the microphone open", () => {
  const setAudioEnabled = renderAndForgetInitialMute();
  fireEvent.keyDown(document.body, { code: "Space" });
  fireEvent.keyUp(document.body, { code: "Space" });
  act(() => vi.advanceTimersByTime(RELEASE_DELAY / 2));
  fireEvent.keyDown(document.body, { code: "Space" });
  act(() => vi.advanceTimersByTime(RELEASE_DELAY * 2));
  expect(setAudioEnabled).toHaveBeenCalledExactlyOnceWith(true);
});

test("works with a mouse side button and stops it navigating", () => {
  pushToTalkBinding.setValue({ type: "mouse", button: 3 });
  const setAudioEnabled = renderAndForgetInitialMute();

  const down = fireEvent.mouseDown(document.body, { button: 3 });
  expect(down).toBe(false); // default prevented
  expect(setAudioEnabled).toHaveBeenLastCalledWith(true);

  const up = fireEvent.mouseUp(window, { button: 3 });
  expect(up).toBe(false);
  act(() => vi.advanceTimersByTime(RELEASE_DELAY));
  expect(setAudioEnabled).toHaveBeenLastCalledWith(false);
});

test("leaves the primary mouse button alone", () => {
  pushToTalkBinding.setValue({ type: "mouse", button: 3 });
  const setAudioEnabled = renderAndForgetInitialMute();
  expect(fireEvent.mouseDown(document.body, { button: 0 })).toBe(true);
  expect(setAudioEnabled).not.toHaveBeenCalled();
});

test("does not steal keys from a text field", () => {
  pushToTalkBinding.setValue({ type: "keyboard", code: "KeyT" });
  const setAudioEnabled = renderAndForgetInitialMute();
  const input = document.createElement("input");
  document.body.append(input);
  input.focus();
  fireEvent.keyDown(input, { code: "KeyT", key: "t" });
  expect(setAudioEnabled).not.toHaveBeenCalled();
  input.remove();
});

test("losing the window releases the key", () => {
  const setAudioEnabled = renderAndForgetInitialMute();
  fireEvent.keyDown(document.body, { code: "Space" });
  fireEvent.blur(window);
  act(() => vi.advanceTimersByTime(RELEASE_DELAY));
  expect(setAudioEnabled).toHaveBeenLastCalledWith(false);
});

test("does nothing while disabled", () => {
  pushToTalkEnabled.setValue(false);
  const setAudioEnabled = vi.fn();
  render(<TestComponent setAudioEnabled={setAudioEnabled} />);
  fireEvent.keyDown(document.body, { code: "Space" });
  fireEvent.keyUp(document.body, { code: "Space" });
  act(() => vi.advanceTimersByTime(RELEASE_DELAY));
  expect(setAudioEnabled).not.toHaveBeenCalled();
});

test("hears the desktop app's system-wide shortcut", () => {
  const bridge = new FakeDesktopBridge();
  window.elementCallDesktop = bridge;
  const setAudioEnabled = renderAndForgetInitialMute();

  expect(bridge.config).toEqual({
    enabled: true,
    binding: defaultPushToTalkBinding,
  });

  act(() => bridge.emit(true));
  expect(setAudioEnabled).toHaveBeenLastCalledWith(true);
  act(() => bridge.emit(false));
  act(() => vi.advanceTimersByTime(RELEASE_DELAY));
  expect(setAudioEnabled).toHaveBeenLastCalledWith(false);
});

test("the window and system hooks hearing the same press open the microphone once", () => {
  const bridge = new FakeDesktopBridge();
  window.elementCallDesktop = bridge;
  const setAudioEnabled = renderAndForgetInitialMute();

  fireEvent.keyDown(document.body, { code: "Space" });
  act(() => bridge.emit(true));
  fireEvent.keyUp(document.body, { code: "Space" });
  act(() => vi.advanceTimersByTime(RELEASE_DELAY));
  expect(setAudioEnabled).toHaveBeenCalledExactlyOnceWith(true);

  act(() => bridge.emit(false));
  act(() => vi.advanceTimersByTime(RELEASE_DELAY));
  expect(setAudioEnabled).toHaveBeenLastCalledWith(false);
});

test("tells the desktop app to stop listening on unmount", () => {
  const bridge = new FakeDesktopBridge();
  window.elementCallDesktop = bridge;
  const { unmount } = render(<TestComponent setAudioEnabled={vi.fn()} />);
  unmount();
  expect(bridge.config?.enabled).toBe(false);
  expect(bridge.listeners.size).toBe(0);
});

const TestComponent: FC<{
  setAudioEnabled: (enabled: boolean) => void;
}> = ({ setAudioEnabled }) => {
  usePushToTalk(setAudioEnabled);
  return null;
};

function renderAndForgetInitialMute(): ReturnType<typeof vi.fn> {
  const setAudioEnabled = vi.fn();
  render(<TestComponent setAudioEnabled={setAudioEnabled} />);
  setAudioEnabled.mockClear();
  return setAudioEnabled;
}

class FakeDesktopBridge implements DesktopBridge {
  public globalPushToTalk = true;
  public config: { enabled: boolean; binding: PushToTalkBinding } | null =
    null;
  public readonly listeners = new Set<(pressed: boolean) => void>();

  public setPushToTalk = (config: {
    enabled: boolean;
    binding: PushToTalkBinding;
  }): void => {
    this.config = config;
  };

  public onPushToTalk = (
    listener: (pressed: boolean) => void,
  ): (() => void) => {
    this.listeners.add(listener);
    return (): void => {
      this.listeners.delete(listener);
    };
  };

  public emit(pressed: boolean): void {
    for (const listener of this.listeners) listener(pressed);
  }
}

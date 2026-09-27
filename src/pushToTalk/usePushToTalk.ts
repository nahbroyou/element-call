/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useEventTarget } from "../useEvents";
import { useLatest } from "../useLatest";
import { useRootElement } from "../RootElementContext";
import { focusIsClaimed } from "../useCallViewKeyboardShortcuts";
import {
  pushToTalkBinding as pushToTalkBindingSetting,
  pushToTalkEnabled as pushToTalkEnabledSetting,
  pushToTalkReleaseDelayMs as pushToTalkReleaseDelaySetting,
  useSetting,
} from "../settings/settings";
import {
  activatesFocusedButton,
  defaultPushToTalkBinding,
  isValidBinding,
  matchesKeyboardEvent,
  matchesMouseEvent,
  type PushToTalkBinding,
} from "./binding";
import { getDesktopBridge } from "./desktopBridge";

/** Where a press came from: this window, or the desktop wrapper's system-wide hook. */
type PressSource = "window" | "system";

export interface PushToTalkState {
  enabled: boolean;
  binding: PushToTalkBinding;
  /** Whether the binding is held (or within its release delay). */
  talking: boolean;
}

/**
 * Discord-style push to talk: while enabled, the microphone is muted except
 * while the user holds their chosen key or mouse button.
 *
 * Inside the desktop wrapper the binding is also heard while another app has
 * focus.
 */
export function usePushToTalk(
  setAudioEnabled: ((enabled: boolean) => void) | null,
): PushToTalkState {
  const [enabled] = useSetting(pushToTalkEnabledSetting);
  const binding = usePushToTalkBinding();
  const [releaseDelayMs] = useSetting(pushToTalkReleaseDelaySetting);
  const rootElement = useRootElement();

  const [talking, setTalking] = useState(false);
  const heldBy = useRef(new Set<PressSource>());
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setAudioEnabledRef = useLatest(setAudioEnabled);
  const releaseDelayRef = useLatest(releaseDelayMs);

  const cancelPendingRelease = useCallback((): void => {
    if (releaseTimer.current !== null) {
      clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    }
  }, []);

  const press = useCallback(
    (source: PressSource): void => {
      cancelPendingRelease();
      const wasHeld = heldBy.current.size > 0;
      heldBy.current.add(source);
      if (!wasHeld) {
        setTalking(true);
        setAudioEnabledRef.current?.(true);
      }
    },
    [cancelPendingRelease, setAudioEnabledRef],
  );

  const release = useCallback(
    (source: PressSource): void => {
      if (!heldBy.current.delete(source) || heldBy.current.size > 0) return;
      cancelPendingRelease();
      releaseTimer.current = setTimeout(() => {
        releaseTimer.current = null;
        setTalking(false);
        setAudioEnabledRef.current?.(false);
      }, releaseDelayRef.current);
    },
    [cancelPendingRelease, setAudioEnabledRef, releaseDelayRef],
  );

  // Entering push to talk (or the microphone becoming controllable while in
  // it) starts the user muted.
  useEffect(() => {
    if (enabled && setAudioEnabled !== null && heldBy.current.size === 0)
      setAudioEnabled(false);
  }, [enabled, setAudioEnabled]);

  useEffect(() => {
    if (enabled) return;
    cancelPendingRelease();
    heldBy.current.clear();
    setTalking(false);
  }, [enabled, cancelPendingRelease]);

  useEffect(() => cancelPendingRelease, [cancelPendingRelease]);

  const captureOptions = useMemo(() => ({ capture: true }), []);

  useEventTarget(
    rootElement,
    "keydown",
    useCallback(
      (event: KeyboardEvent) => {
        if (!enabled || !matchesKeyboardEvent(binding, event)) return;
        if (focusIsClaimed()) return;
        if (activatesFocusedButton(binding) && buttonHasFocus()) return;
        event.preventDefault();
        if (!event.repeat) press("window");
      },
      [enabled, binding, press],
    ),
    captureOptions,
  );

  useEventTarget(
    rootElement,
    "keyup",
    useCallback(
      (event: KeyboardEvent) => {
        if (!enabled || !matchesKeyboardEvent(binding, event)) return;
        // Released whatever has focus now, so that the microphone can never
        // be left open by focus moving while the key was down
        if (heldBy.current.has("window")) event.preventDefault();
        release("window");
      },
      [enabled, binding, release],
    ),
    captureOptions,
  );

  useEventTarget(
    rootElement,
    "mousedown",
    useCallback(
      (event: MouseEvent) => {
        if (!enabled || !matchesMouseEvent(binding, event)) return;
        event.preventDefault();
        press("window");
      },
      [enabled, binding, press],
    ),
    captureOptions,
  );

  // A button pressed inside the window reports its release to the window even
  // when the pointer has left it.
  useEventTarget(
    rootElement.ownerDocument.defaultView,
    "mouseup",
    useCallback(
      (event: MouseEvent) => {
        if (!enabled || !matchesMouseEvent(binding, event)) return;
        // Stops the back / forward side buttons navigating away from the call
        event.preventDefault();
        release("window");
      },
      [enabled, binding, release],
    ),
    captureOptions,
  );

  const suppressBoundMouseDefault = useCallback(
    (event: MouseEvent) => {
      if (enabled && matchesMouseEvent(binding, event)) event.preventDefault();
    },
    [enabled, binding],
  );
  useEventTarget(rootElement, "auxclick", suppressBoundMouseDefault);
  useEventTarget(rootElement, "contextmenu", suppressBoundMouseDefault);

  // The window's key and mouse ups stop arriving once it loses focus
  useEventTarget(
    rootElement.ownerDocument.defaultView,
    "blur",
    useCallback(() => release("window"), [release]),
  );

  useEffect(() => {
    const bridge = getDesktopBridge(rootElement);
    if (bridge === null) return;
    bridge.setPushToTalk({ enabled, binding });
    if (!enabled) return;
    const unsubscribe = bridge.onPushToTalk((pressed) =>
      pressed ? press("system") : release("system"),
    );
    return (): void => {
      unsubscribe();
      release("system");
      bridge.setPushToTalk({ enabled: false, binding });
    };
  }, [rootElement, enabled, binding, press, release]);

  return { enabled, binding, talking };
}

/** The saved binding, or the default if what was saved is unusable. */
export function usePushToTalkBinding(): PushToTalkBinding {
  const [binding] = useSetting(pushToTalkBindingSetting);
  return isValidBinding(binding) ? binding : defaultPushToTalkBinding;
}

function buttonHasFocus(): boolean {
  return document.activeElement?.tagName.toLowerCase() === "button";
}

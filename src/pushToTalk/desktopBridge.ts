/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type PushToTalkBinding } from "./binding";

/**
 * What the Element Call desktop wrapper (see `desktop/`) exposes to the page
 * through its preload script. A browser can only hear keys while its window
 * has focus; the wrapper hooks input system-wide so push to talk keeps working
 * while another app is in front.
 */
export interface DesktopBridge {
  /** Whether a system-wide input hook is running. */
  globalPushToTalk: boolean;
  /** Tells the wrapper what to listen for, or to stop listening. */
  setPushToTalk: (config: {
    enabled: boolean;
    binding: PushToTalkBinding;
  }) => void;
  /**
   * Subscribes to the binding being pressed (`true`) and released (`false`)
   * anywhere on the system. Returns an unsubscribe function.
   */
  onPushToTalk: (listener: (pressed: boolean) => void) => () => void;
}

/**
 * The desktop wrapper's bridge, if Element Call is running inside it.
 *
 * Read from the window of the document Element Call was rendered into, so a
 * host page embedding the component is not mistaken for the wrapper.
 */
export function getDesktopBridge(root: Element): DesktopBridge | null {
  return root.ownerDocument.defaultView?.elementCallDesktop ?? null;
}

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@vector-im/compound-web";

import { FieldRow, InputField } from "../input/Input";
import { Slider } from "../Slider";
import { useRootElement } from "../RootElementContext";
import { useLatest } from "../useLatest";
import {
  pushToTalkBinding as pushToTalkBindingSetting,
  pushToTalkEnabled as pushToTalkEnabledSetting,
  pushToTalkReleaseDelayMs as pushToTalkReleaseDelaySetting,
  useSetting,
} from "../settings/settings";
import {
  bindingFromKeyboardEvent,
  bindingFromMouseEvent,
  describeBinding,
  type PushToTalkBinding,
} from "./binding";
import { getDesktopBridge } from "./desktopBridge";
import { usePushToTalkBinding } from "./usePushToTalk";
import styles from "./PushToTalkSettings.module.css";

const MAX_RELEASE_DELAY_MS = 1000;

/**
 * Push to talk section of the audio settings: turning it on, choosing the key
 * or mouse button, and how long the microphone lingers after release.
 */
export const PushToTalkSettings: FC = () => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useSetting(pushToTalkEnabledSetting);
  const binding = usePushToTalkBinding();
  const [, setBinding] = useSetting(pushToTalkBindingSetting);
  const [releaseDelay, setReleaseDelay] = useSetting(
    pushToTalkReleaseDelaySetting,
  );
  const [releaseDelayRaw, setReleaseDelayRaw] = useState(releaseDelay);
  const [capturing, setCapturing] = useState(false);
  const rootElement = useRootElement();
  const hasGlobalHook =
    getDesktopBridge(rootElement)?.globalPushToTalk ?? false;

  useBindingCapture(capturing, (captured) => {
    setCapturing(false);
    if (captured !== null) setBinding(captured);
  });

  return (
    <div className={styles.pushToTalk}>
      <FieldRow>
        <InputField
          id="pushToTalkEnabled"
          type="checkbox"
          label={t("push_to_talk.enable_label")}
          description={t("push_to_talk.enable_description")}
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      </FieldRow>
      {enabled && (
        <>
          <div className={styles.bindingRow}>
            <span>{t("push_to_talk.binding_label")}</span>
            <kbd className={styles.binding} aria-live="polite">
              {capturing
                ? t("push_to_talk.capture_prompt")
                : describeBinding(binding, t)}
            </kbd>
            <Button
              kind="secondary"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                setCapturing((c) => !c);
              }}
            >
              {capturing
                ? t("push_to_talk.cancel_button")
                : t("push_to_talk.change_binding_button")}
            </Button>
          </div>
          <p className={styles.hint}>
            {hasGlobalHook
              ? t("push_to_talk.scope_global")
              : t("push_to_talk.scope_window")}
          </p>
          <div className={styles.releaseDelay}>
            <label>
              {t("push_to_talk.release_delay_label")}
              {": "}
              <span className={styles.value}>
                {t("push_to_talk.milliseconds", { ms: releaseDelayRaw })}
              </span>
            </label>
            <p>{t("push_to_talk.release_delay_description")}</p>
            <Slider
              label={t("push_to_talk.release_delay_label")}
              value={releaseDelayRaw}
              onValueChange={setReleaseDelayRaw}
              onValueCommit={setReleaseDelay}
              min={0}
              max={MAX_RELEASE_DELAY_MS}
              step={10}
              tooltipFormatter={(ms) => t("push_to_talk.milliseconds", { ms })}
            />
          </div>
        </>
      )}
    </div>
  );
};

/**
 * While `active`, takes the next key or non-primary mouse button the user
 * presses, anywhere in the window, and reports it; Escape reports `null`.
 *
 * Mouse buttons are taken on release so that the release (which is what
 * triggers a side button's back / forward navigation) is swallowed too.
 */
function useBindingCapture(
  active: boolean,
  onCaptured: (binding: PushToTalkBinding | null) => void,
): void {
  const rootElement = useRootElement();
  const onCapturedLatest = useLatest(onCaptured);

  useEffect(() => {
    const win = rootElement.ownerDocument.defaultView;
    if (!active || win === null) return;
    let pendingMouseButton: number | null = null;

    const onKeyDown = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (event.code === "Escape") {
        onCapturedLatest.current(null);
        return;
      }
      const captured = bindingFromKeyboardEvent(event);
      if (captured !== null) onCapturedLatest.current(captured);
    };
    const onMouseDown = (event: MouseEvent): void => {
      if (bindingFromMouseEvent(event) === null) return;
      event.preventDefault();
      event.stopPropagation();
      pendingMouseButton = event.button;
    };
    const onMouseUp = (event: MouseEvent): void => {
      if (event.button !== pendingMouseButton) return;
      event.preventDefault();
      event.stopPropagation();
      onCapturedLatest.current(bindingFromMouseEvent(event));
    };
    const swallow = (event: Event): void => event.preventDefault();

    win.addEventListener("keydown", onKeyDown, true);
    win.addEventListener("mousedown", onMouseDown, true);
    win.addEventListener("mouseup", onMouseUp, true);
    win.addEventListener("contextmenu", swallow, true);
    win.addEventListener("auxclick", swallow, true);
    return (): void => {
      win.removeEventListener("keydown", onKeyDown, true);
      win.removeEventListener("mousedown", onMouseDown, true);
      win.removeEventListener("mouseup", onMouseUp, true);
      win.removeEventListener("contextmenu", swallow, true);
      win.removeEventListener("auxclick", swallow, true);
    };
  }, [active, rootElement, onCapturedLatest]);
}

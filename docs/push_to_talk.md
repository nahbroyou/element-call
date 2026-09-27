# Push to talk

This fork adds Discord-style push to talk to Element Call.

## Using it

1. In a call (or the lobby), open **Settings → Audio**.
2. Turn on **Push to talk**.
3. Click **Change** next to _Shortcut_, then press the key or mouse button you
   want. Any key works, including a modifier on its own (e.g. Left Ctrl) and
   F13–F24. Mouse buttons other than the left one work too: middle, right and
   the side buttons (Mouse 4 / Mouse 5). Press Escape to cancel.
4. Optionally adjust **Release delay**, how long the microphone stays open after
   you let go (default 100 ms), so the end of a word isn't clipped.

While push to talk is on:

- You join calls muted, and turning it on mid-call mutes you.
- Holding the shortcut opens the microphone; releasing it mutes you again.
- The built-in "hold Space to talk" shortcut is replaced by your binding, and
  none of the other single-key shortcuts (M, V, H, 1–9) fire on it.
- The microphone button still works if you want to go open-mic temporarily; the
  next push-to-talk release mutes you again.
- Settings are stored per browser in `localStorage`
  (`matrix-setting-push-to-talk-*`).

## Where the shortcut is heard

| Where Element Call runs                             | Shortcut works…                    |
| --------------------------------------------------- | ---------------------------------- |
| A browser tab, or as a widget in Element Web/Desktop | only while that window has focus   |
| The desktop wrapper in [`desktop/`](../desktop)      | everywhere, even with another app in front |

Browsers only deliver key and mouse events to the focused page, so a
system-wide shortcut needs the desktop wrapper. It hooks input system-wide with
[libuiohook](https://github.com/kwhat/libuiohook) (via `uiohook-napi`), only
while push to talk is on, and tells the page through
`window.elementCallDesktop` (see `src/pushToTalk/desktopBridge.ts`).

## Code map

| File                                     | What it does                                                          |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `src/pushToTalk/binding.ts`              | Binding type, matching events, naming bindings                        |
| `src/pushToTalk/usePushToTalk.ts`        | Hold-to-talk logic, local key/mouse listeners, desktop bridge wiring  |
| `src/pushToTalk/PushToTalkSettings.tsx`  | Settings UI and the "press a key" capture                             |
| `src/pushToTalk/desktopBridge.ts`        | Interface the desktop wrapper's preload exposes                       |
| `src/settings/settings.ts`               | `pushToTalkEnabled`, `pushToTalkBinding`, `pushToTalkReleaseDelayMs`  |
| `src/state/useMuteStates.ts`             | Join muted when push to talk is on                                     |
| `src/useCallViewKeyboardShortcuts.ts`    | Yields the bound key to push to talk                                   |
| `desktop/`                               | Electron wrapper with the system-wide hook                             |

## Known limitations

- The first press after joining muted can take a moment, because the browser
  only opens the microphone the first time you talk. Later presses are
  instant (the track is muted, not stopped).
- While a dialog (e.g. Settings) has focus, keyboard push to talk is paused
  in the browser; mouse buttons and the desktop wrapper's system-wide hook
  still work.
- Keys without a physical code (some IME / media keys) can't be bound.

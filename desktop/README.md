# Element Call desktop (push to talk)

A small Electron wrapper that opens your Element Call deployment in its own
window and makes the push to talk shortcut work **system-wide**, like Discord,
so you can talk while a game or another app is in front.

It loads whatever Element Call URL you give it. That deployment must be built
from this fork (with `src/pushToTalk/`), since the page is what decides the
binding and mutes/unmutes the microphone.

## Run it

```sh
cd desktop
npm install
npm start                     # asks for your Element Call URL on first run
# or
npm start -- --url=https://call.example.com
ELEMENT_CALL_URL=https://call.example.com npm start
```

The URL is saved; change it later from the app menu → **Change Element Call
Server…** (a `--url` flag or `ELEMENT_CALL_URL` overrides the saved one).

Then in a call: **Settings → Audio → Push to talk**, choose your key or mouse
button. The settings page says "works even while another app is in front" when
the system-wide hook is available.

## Build an installer

```sh
npm run dist:mac      # .dmg (unsigned unless you configure signing)
npm run dist:win      # NSIS installer
npm run dist:linux    # AppImage
```

## Permissions

- **macOS:** the first time you enable push to talk, macOS asks you to allow
  Element Call under **System Settings → Privacy & Security → Accessibility**
  (on some versions also **Input Monitoring**). Allow it, then quit and reopen
  the app. Until then push to talk only works while the window is focused.
  Microphone and camera prompts appear as usual.
- **Linux:** the hook needs an X11 session (or XWayland apps); pure Wayland
  compositors don't allow global input hooks.
- **Windows:** no extra permission needed.

## Privacy

The input hook runs only while push to talk is enabled in a call, is stopped
when you leave the call or turn push to talk off, and only reports whether
your one bound key/button is down. Nothing else is recorded or sent.

## Tests

```sh
npm test   # node's built-in test runner; no Electron needed
```

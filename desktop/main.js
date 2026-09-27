/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// Element Call in a desktop window, with push to talk that keeps working while
// another app has focus.

const path = require("node:path");
const fs = require("node:fs");
const {
  app,
  BrowserWindow,
  Menu,
  desktopCapturer,
  dialog,
  ipcMain,
  session,
  shell,
  systemPreferences,
} = require("electron");
const { uIOhook, UiohookKey } = require("uiohook-napi");

const { GlobalPushToTalk } = require("./globalPushToTalk");
const { createKeymap } = require("./keymap");

const configPath = () => path.join(app.getPath("userData"), "config.json");

/** @type {BrowserWindow | null} */
let mainWindow = null;
let accessibilityPrompted = false;

const globalPushToTalk = new GlobalPushToTalk({
  hook: uIOhook,
  keymap: createKeymap(UiohookKey),
  onChange: (pressed) =>
    mainWindow?.webContents.send("push-to-talk:pressed", pressed),
  log: (message, error) => console.warn(message, error ?? ""),
});

if (!app.requestSingleInstanceLock()) app.quit();

app.on("second-instance", () => {
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.focus();
});

app.whenReady().then(async () => {
  if (process.platform === "darwin")
    await systemPreferences.askForMediaAccess("microphone");

  setUpPermissions();
  setUpMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  globalPushToTalk.dispose();
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => globalPushToTalk.dispose());

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 400,
    title: "Element Call",
    backgroundColor: "#101317",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Audio and the release-delay timer must keep running while the window
      // is behind another app
      backgroundThrottling: false,
    },
  });

  const wc = mainWindow.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    if (isElementCallUrl(url)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (event, url) => {
    if (isElementCallUrl(url) || url.startsWith("file:")) return;
    event.preventDefault();
    void shell.openExternal(url);
  });
  // A new page will send its own push to talk settings once it has them
  // Without this a server that can't be reached leaves an empty window
  wc.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      // -3 is a load cancelled by another navigation, not a failure
      if (!isMainFrame || errorCode === -3 || validatedURL.startsWith("file:"))
        return;
      showSetup(`Couldn't open ${validatedURL} (${errorDescription}).`);
    },
  );
  wc.on("did-start-navigation", ({ isMainFrame, isSameDocument }) => {
    if (isMainFrame && !isSameDocument) globalPushToTalk.dispose();
  });
  mainWindow.on("closed", () => {
    globalPushToTalk.dispose();
    mainWindow = null;
  });

  loadStart();
}

function loadStart() {
  const url = elementCallUrl();
  if (url === null) showSetup();
  else void mainWindow?.loadURL(url);
}

/** @param {string} [error] shown on the setup page */
function showSetup(error) {
  void mainWindow?.loadFile(path.join(__dirname, "setup.html"), {
    query: error ? { error } : {},
  });
}

ipcMain.on("push-to-talk:set", (event, config) => {
  if (!isFromElementCall(event)) return;
  if (config?.enabled) ensureInputMonitoringAllowed();
  globalPushToTalk.configure(config ?? { enabled: false, binding: null });
});

ipcMain.handle("setup:get", (event) =>
  isFromSetupPage(event) ? elementCallUrl() ?? "" : "",
);

ipcMain.handle("setup:save", (event, rawUrl) => {
  if (!isFromSetupPage(event)) return "Not allowed";
  let url;
  try {
    url = new URL(String(rawUrl).trim());
  } catch {
    return "That doesn't look like a URL.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:")
    return "The URL must start with https://";
  writeConfig({ ...readConfig(), url: url.toString() });
  loadStart();
  return null;
});

/**
 * macOS only delivers keyboard and mouse events from other apps to apps the
 * user has trusted in System Settings → Privacy & Security → Accessibility.
 */
function ensureInputMonitoringAllowed() {
  if (process.platform !== "darwin") return;
  if (systemPreferences.isTrustedAccessibilityClient(false)) return;
  if (accessibilityPrompted) return;
  accessibilityPrompted = true;
  systemPreferences.isTrustedAccessibilityClient(true);
  void dialog.showMessageBox({
    type: "info",
    message: "Allow Element Call to hear your push to talk shortcut",
    detail:
      "To use push to talk while another app is in front, turn on Element Call in System Settings → Privacy & Security → Accessibility, then quit and reopen Element Call.\n\nUntil then, push to talk works while the Element Call window is focused.",
  });
}

function setUpPermissions() {
  const allowed = new Set([
    "media",
    "display-capture",
    "fullscreen",
    "notifications",
    "clipboard-sanitized-write",
    "speaker-selection",
    "window-management",
  ]);
  const ses = session.defaultSession;
  const isAllowed = (permission, url) =>
    allowed.has(permission) && isElementCallUrl(url);
  ses.setPermissionRequestHandler((_wc, permission, callback, details) =>
    callback(isAllowed(permission, details.requestingUrl)),
  );
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) =>
    isAllowed(permission, requestingOrigin),
  );
  ses.setDisplayMediaRequestHandler(
    (request, callback) => {
      // Reached only where there is no system picker
      desktopCapturer
        .getSources({ types: ["screen", "window"] })
        .then((sources) => callback(sources[0] ? { video: sources[0] } : {}))
        .catch(() => callback({}));
    },
    { useSystemPicker: true },
  );
}

function setUpMenu() {
  const isMac = process.platform === "darwin";
  const changeUrl = {
    label: "Change Element Call Server…",
    click: () => showSetup(),
  };
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac
        ? [
            {
              role: "appMenu",
              submenu: [
                { role: "about" },
                { type: "separator" },
                changeUrl,
                { type: "separator" },
                { role: "services" },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
              ],
            },
          ]
        : [{ label: "File", submenu: [changeUrl, { role: "quit" }] }]),
      { role: "editMenu" },
      { role: "viewMenu" },
      { role: "windowMenu" },
    ]),
  );
}

/**
 * The Element Call URL: `--url=`, then $ELEMENT_CALL_URL, then the one saved
 * from the setup page, then the one baked in at build time.
 */
function elementCallUrl() {
  const flag = process.argv.find((a) => a.startsWith("--url="));
  if (flag) return flag.slice("--url=".length);
  if (process.env.ELEMENT_CALL_URL) return process.env.ELEMENT_CALL_URL;
  return readConfig().url ?? bakedInUrl();
}

/** Set by the release build via `-c.extraMetadata.defaultElementCallUrl`. */
function bakedInUrl() {
  const { defaultElementCallUrl } = require("./package.json");
  return defaultElementCallUrl || null;
}

function isElementCallUrl(url) {
  const configured = elementCallUrl();
  if (configured === null || !url) return false;
  try {
    return new URL(url).origin === new URL(configured).origin;
  } catch {
    return false;
  }
}

function isFromElementCall(event) {
  return (
    event.sender === mainWindow?.webContents &&
    isElementCallUrl(event.senderFrame?.url)
  );
}

function isFromSetupPage(event) {
  return (
    event.sender === mainWindow?.webContents &&
    event.senderFrame?.url.startsWith("file:")
  );
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

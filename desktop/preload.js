/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// The bridge Element Call looks for as `window.elementCallDesktop` (see
// src/pushToTalk/desktopBridge.ts), or the setup page's API when that is what
// is loaded.

const { contextBridge, ipcRenderer } = require("electron");

if (location.protocol === "file:") {
  contextBridge.exposeInMainWorld("elementCallSetup", {
    getUrl: () => ipcRenderer.invoke("setup:get"),
    saveUrl: (url) => ipcRenderer.invoke("setup:save", url),
  });
} else {
  contextBridge.exposeInMainWorld("elementCallDesktop", {
    globalPushToTalk: true,
    setPushToTalk: (config) =>
      ipcRenderer.send("push-to-talk:set", {
        enabled: Boolean(config?.enabled),
        binding: config?.binding ?? null,
      }),
    onPushToTalk: (listener) => {
      const handler = (_event, pressed) => listener(Boolean(pressed));
      ipcRenderer.on("push-to-talk:pressed", handler);
      return () => ipcRenderer.removeListener("push-to-talk:pressed", handler);
    },
  });
}

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  showDesktopNotification: (title, message, options = {}) =>
    ipcRenderer.invoke("show-desktop-notification", {
      title,
      message,
      requireInteraction: Boolean(options.requireInteraction),
      silent: Boolean(options.silent),
    }),
});

const { app, BrowserWindow, ipcMain, Notification, shell } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.loadFile(
    path.join(__dirname, "..", "dist", "index.html"),
    { hash: "/login" },
  );

  return win;
}

ipcMain.handle("show-desktop-notification", async (_, { title, message, requireInteraction, silent }) => {
  const desktopNotification = new Notification({
    title,
    body: message,
    silent: Boolean(silent),
    requireInteraction: Boolean(requireInteraction),
  });

  desktopNotification.show();
  return true;
});

ipcMain.handle("play-admin-call-sound", () => {
  shell.beep();
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
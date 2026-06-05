/**
 * Electron 主进程入口
 * 创建 BrowserWindow 实例，注册 IPC 处理器，管理应用生命周期
 */

import { app, BrowserWindow } from 'electron';
import { join } from 'path';

/** 窗口引用 */
let mainWindow: BrowserWindow | null = null;
let subtitleWindow: BrowserWindow | null = null;
let controlWindow: BrowserWindow | null = null;

/** 获取预加载脚本路径（开发/生产环境适配） */
function getPreloadPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return join(__dirname, '../../preload/index.js');
  }
  return join(__dirname, '../preload/index.js');
}

/** 获取渲染进程入口路径 */
function getRendererPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return join(__dirname, '../../renderer/index.html');
  }
  return join(__dirname, '../renderer/index.html');
}

/**
 * 创建主窗口（三栏布局）
 */
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'SynchroLens — AI 同声传译助手',
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  win.loadFile(getRendererPath());

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

/**
 * 创建悬浮字幕窗口
 */
function createSubtitleWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 800,
    height: 120,
    x: 0,
    y: 0,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  win.loadFile(getRendererPath());
  win.setIgnoreMouseEvents(true, { forward: true });

  return win;
}

/**
 * 创建控制悬浮窗
 */
function createControlWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 320,
    height: 48,
    x: 0,
    y: 0,
    alwaysOnTop: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  win.loadFile(getRendererPath());

  return win;
}

/**
 * 获取所有活跃窗口引用
 */
export function getAllWindows(): BrowserWindow[] {
  const windows: BrowserWindow[] = [];
  if (mainWindow && !mainWindow.isDestroyed()) windows.push(mainWindow);
  if (subtitleWindow && !subtitleWindow.isDestroyed()) windows.push(subtitleWindow);
  if (controlWindow && !controlWindow.isDestroyed()) windows.push(controlWindow);
  return windows;
}

/**
 * 获取主窗口引用
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * 获取字幕窗口引用
 */
export function getSubtitleWindow(): BrowserWindow | null {
  return subtitleWindow;
}

/**
 * 获取控制窗口引用
 */
export function getControlWindow(): BrowserWindow | null {
  return controlWindow;
}

/**
 * 注册应用生命周期
 */
export function registerAppLifecycle(): void {
  app.whenReady().then(() => {
    mainWindow = createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

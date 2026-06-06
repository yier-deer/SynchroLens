/**
 * Electron 主进程入口
 * 创建 BrowserWindow 实例，注册 IPC 处理器，管理应用生命周期
 */

import { app, BrowserWindow, Tray, Menu, ipcMain } from 'electron';
import { join } from 'path';
import appLogger from './utils/logger';
import { setBrowserWindows, registerIPCHandlers } from './ipc/handlers';

/** 窗口引用 */
let mainWindow: BrowserWindow | null = null;
let subtitleWindow: BrowserWindow | null = null;
let controlWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

/** 获取预加载脚本路径（开发/生产环境适配） */
function getPreloadPath(): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return join(__dirname, '../../preload/index.js');
  }
  return join(__dirname, '../preload/index.js');
}

/** 获取渲染进程入口路径 */
function getRendererPath(page: string = 'index'): string {
  const isDev = !app.isPackaged;
  if (isDev) {
    return join(__dirname, `../../renderer/${page}.html`);
  }
  return join(__dirname, `../renderer/${page}.html`);
}

/**
 * 创建主窗口（三栏布局）
 */
function createMainWindow(): BrowserWindow {
  appLogger.info('主窗口已创建');
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
  appLogger.info('字幕窗口已创建');
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

  win.loadFile(getRendererPath('subtitle'));
  win.setIgnoreMouseEvents(true, { forward: true });

  return win;
}

/**
 * 创建控制悬浮窗
 */
function createControlWindow(): BrowserWindow {
  appLogger.info('控制窗口已创建');
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

  win.loadFile(getRendererPath('control'));

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
 * 创建系统托盘
 */
function createTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.png');
  try {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示控制窗',
        click: () => {
          if (controlWindow && !controlWindow.isDestroyed()) {
            controlWindow.show();
            controlWindow.focus();
          }
        }
      },
      {
        label: '退出 SynchroLens',
        click: () => { app.quit(); }
      }
    ]);
    tray.setToolTip('SynchroLens');
    tray.setContextMenu(contextMenu);
    appLogger.info('系统托盘已创建');
  } catch {
    appLogger.warn('系统托盘图标加载失败，跳过');
  }
}

function setupIpcHandlers(): void {
  ipcMain.handle('window:prepare-record', () => {
    if (!subtitleWindow || subtitleWindow.isDestroyed()) {
      subtitleWindow = createSubtitleWindow();
      subtitleWindow.show();
    }
    if (!controlWindow || controlWindow.isDestroyed()) {
      controlWindow = createControlWindow();
      controlWindow.show();
    }
    if (mainWindow) { mainWindow.minimize(); }
  });

  ipcMain.handle('window:exit-control', (_event, payload: { action: string }) => {
    if (payload.action === 'minimize') {
      if (controlWindow && !controlWindow.isDestroyed()) { controlWindow.hide(); }
    } else if (payload.action === 'stop') {
      if (controlWindow && !controlWindow.isDestroyed()) { controlWindow.close(); }
      if (subtitleWindow && !subtitleWindow.isDestroyed()) { subtitleWindow.close(); }
    }
  });

  ipcMain.handle('window:toggle-subtitle', (_event, payload: { visible: boolean }) => {
    if (subtitleWindow && !subtitleWindow.isDestroyed()) {
      payload.visible ? subtitleWindow.show() : subtitleWindow.hide();
    }
  });

  ipcMain.handle('favorite:get', () => []);
  ipcMain.handle('favorite:add', () => {});
  ipcMain.handle('favorite:remove', () => {});
  ipcMain.handle('favorite:remove-batch', () => {});
  ipcMain.handle('favorite:search', () => []);
  ipcMain.handle('favorite:export', () => {});
  ipcMain.handle('improve:submit', () => {});
  ipcMain.handle('personal-dict:status', () => false);
  ipcMain.handle('dictionary:entries:get', () => []);
  ipcMain.handle('dictionary:entry:remove', () => {});
  ipcMain.handle('dictionary:file:load', () => {});
  ipcMain.handle('dictionary:file:remove', () => {});
  ipcMain.handle('dictionary:file:toggle', () => {});
  ipcMain.handle('notes:list', () => []);
  ipcMain.handle('notes:read', () => '');
  ipcMain.handle('notes:export-all', () => {});
  ipcMain.handle('data:clear', () => {});

  registerIPCHandlers();
}

/**
 * 注册应用生命周期
 */
export function registerAppLifecycle(): void {
  app.whenReady().then(() => {
    appLogger.info('SynchroLens 应用启动中');
    mainWindow = createMainWindow();
    createTray();
    setBrowserWindows(getAllWindows());
    setupIpcHandlers();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
      }
    });

    appLogger.info('SynchroLens 应用已就绪');
  });

  app.on('window-all-closed', () => {
    appLogger.info('所有窗口已关闭');
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

/**
 * Electron 主进程入口
 * 创建 BrowserWindow 实例，注册 IPC 处理器，管理应用生命周期
 */

import { app, BrowserWindow, Tray, Menu, ipcMain } from 'electron';
import { join } from 'path';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import appLogger from './utils/logger';
import { setBrowserWindows, registerIPCHandlers, setModuleRegistry, sendToAllWindows } from './ipc/handlers';
import type { ModuleRegistry } from './ipc/handlers';
import { AudioCapture } from './modules/audio/AudioCapture';
import { STTClient } from './modules/stt/STTClient';
import { Translator } from './modules/translate/Translator';
import { NoteWriter } from './modules/note/NoteWriter';
import { CorrectionDetector } from './modules/correction/CorrectionDetector';
import { SessionManager } from './modules/session/SessionManager';
import { FavoriteStore } from './modules/favorite/FavoriteStore';
import { NoteReader } from './modules/note/NoteReader';
import { DictStore } from './modules/dictionary/DictStore';
import { PersonalDictStore } from './modules/dictionary/PersonalDictStore';
import type { Session } from '../shared/types';
import { IPC_CHANNELS } from '../shared/ipcChannels';

try {
  const envPath = join(__dirname, '../../.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
} catch { appLogger.warn('.env 文件加载失败，将使用系统环境变量'); }

/** 窗口引用 */
let mainWindow: BrowserWindow | null = null;
let subtitleWindow: BrowserWindow | null = null;
let controlWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let favoriteStore: FavoriteStore | null = null;
let noteReader: NoteReader | null = null;
let dictStore: DictStore | null = null;
let personalDictStore: PersonalDictStore | null = null;

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
    setBrowserWindows(getAllWindows());
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

  win.on('closed', () => {
    subtitleWindow = null;
    setBrowserWindows(getAllWindows());
  });

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

  win.on('closed', () => {
    controlWindow = null;
    setBrowserWindows(getAllWindows());
  });

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
    setBrowserWindows(getAllWindows());
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

  ipcMain.handle(IPC_CHANNELS.FAVORITE_GET, () => favoriteStore?.getAll() ?? []);
  ipcMain.handle(IPC_CHANNELS.FAVORITE_ADD, (_e, payload) => favoriteStore!.add(payload));
  ipcMain.handle(IPC_CHANNELS.FAVORITE_REMOVE, (_e, payload: { id: string }) => favoriteStore!.remove(payload.id));
  ipcMain.handle(IPC_CHANNELS.FAVORITE_REMOVE_BATCH, (_e, payload: { ids: string[] }) => favoriteStore!.removeBatch(payload.ids));
  ipcMain.handle(IPC_CHANNELS.FAVORITE_SEARCH, (_e, payload: { query: string }) => favoriteStore!.search(payload.query));
  ipcMain.handle(IPC_CHANNELS.FAVORITE_EXPORT, (_e, payload: { ids: string[]; savePath: string }) => favoriteStore!.exportToMarkdown(payload.ids, payload.savePath));
  ipcMain.handle(IPC_CHANNELS.IMPROVE_SUBMIT, (_e, payload: { original: string; improved: string; reason: string; context: string }) => {
    personalDictStore!.add({ source: payload.original, target: payload.improved, improvement: payload.reason, sourceNote: '' });
  });
  ipcMain.handle(IPC_CHANNELS.PERSONAL_DICT_STATUS, () => !!process.env.DEEPSEEK_API_KEY);
  ipcMain.handle(IPC_CHANNELS.DICTIONARY_ENTRIES_GET, (_e, payload: { dictType: string }) => dictStore!.getEntries(payload.dictType));
  ipcMain.handle(IPC_CHANNELS.DICTIONARY_ENTRY_REMOVE, (_e, payload: { dictType: string; filePath: string; idx: number }) => dictStore!.removeEntry(payload.dictType, payload.filePath, payload.idx));
  ipcMain.handle(IPC_CHANNELS.DICTIONARY_FILE_LOAD, (_e, payload: { dictType: string; filePath: string }) => dictStore!.loadFile(payload.dictType, payload.filePath));
  ipcMain.handle(IPC_CHANNELS.DICTIONARY_FILE_REMOVE, (_e, payload: { dictType: string; filePath: string }) => dictStore!.removeFile(payload.dictType, payload.filePath));
  ipcMain.handle(IPC_CHANNELS.DICTIONARY_FILE_TOGGLE, (_e, payload: { dictType: string; filePath: string; enabled: boolean }) => dictStore!.toggleFile(payload.dictType, payload.filePath, payload.enabled));
  ipcMain.handle(IPC_CHANNELS.NOTES_LIST, (_e, payload: { dirPath?: string }) => noteReader!.listNotes(payload?.dirPath));
  ipcMain.handle(IPC_CHANNELS.NOTES_READ, (_e, payload: { filePath: string }) => noteReader!.readNote(payload.filePath));
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

    const audioCapture = new AudioCapture();
    const sttClient = new STTClient();
    const translator = new Translator({
      apiKey: process.env.DEEPSEEK_API_KEY || '',
    });
    const noteWriter = new NoteWriter();
    const correctionDetector = new CorrectionDetector();
    favoriteStore = new FavoriteStore();
    noteReader = new NoteReader(join(homedir(), 'SynchroLens', 'Notes'));
    dictStore = new DictStore();
    personalDictStore = new PersonalDictStore();
    const sessionManager = new SessionManager({
      audioCapture, sttClient, translator, noteWriter, correctionDetector
    });

    let currentSession: Session | null = null;

    sessionManager.onSessionStateChange((_sessionId, state) => {
      sendToAllWindows(IPC_CHANNELS.SESSION_STATE_CHANGE, { state });
    });

    sessionManager.onSessionSTTPartial((_sessionId, data) => {
      const d = data as { sentenceId: string; text: string; isFinal: boolean };
      if (d.isFinal) {
        sendToAllWindows(IPC_CHANNELS.STT_SENTENCE, { sentenceId: d.sentenceId, text: d.text, timestamp: Date.now() });
      } else {
        sendToAllWindows(IPC_CHANNELS.STT_PARTIAL, { sentenceId: d.sentenceId, text: d.text, isFinal: false });
      }
    });

    sessionManager.onSessionTranslatePartial((_sessionId, data) => {
      sendToAllWindows(IPC_CHANNELS.TRANSLATE_PARTIAL, data);
    });

    sessionManager.onSessionTranslateFinal((_sessionId, data) => {
      const d = data as { sentenceId: string; original: string; translation: string; corrections: unknown[] };
      sendToAllWindows(IPC_CHANNELS.TRANSLATE_FINAL, data);
      if (currentSession?.notePath && d.original) {
        noteWriter.appendEntry(
          currentSession.notePath,
          d.original,
          d.translation,
          Date.now(),
        ).catch(err => appLogger.warn('笔记写入失败', { error: (err as Error).message }));
      }
    });

    const registry: ModuleRegistry = {
      audioCapture,
      sttClient,
      translator,
      noteWriter,
      correctionDetector,
      sessionManager: {
        createSession(config) {
          currentSession = sessionManager.createSession(config.audioSource);
          try {
            currentSession.notePath = noteWriter.createNoteFile(currentSession);
          } catch (err) {
            appLogger.warn('笔记文件创建失败', { error: (err as Error).message });
          }
          return currentSession;
        },
        startSession(_sessionId) {
          if (currentSession) sessionManager.startSession(currentSession);
        },
        pauseSession(_sessionId) { sessionManager.pauseSession(); },
        resumeSession(_sessionId) { sessionManager.resumeSession(); },
        async endSession(_sessionId) { await sessionManager.endSession(); },
        getSessionState(_sessionId) { return sessionManager.getSessionState(); },
        updateConfig(config) { sessionManager.updateConfig(config); },
        async triggerSummary() { await sessionManager.triggerSummary(); },
      },
    };

    setModuleRegistry(registry);

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

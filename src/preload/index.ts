import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import { LOG_CHANNELS } from '../shared/logIpcChannels';
import type { LogLevel } from '../shared/logTypes';

const listenerMap = new Map<string, Set<(...args: unknown[]) => void>>();

ipcRenderer.on('synchroLens:event', (_event, channel: string, ...args: unknown[]) => {
  const listeners = listenerMap.get(channel);
  if (listeners) {
    for (const cb of listeners) {
      cb(...args);
    }
  }
});

export interface SynchroLensAPI {
  on(channel: string, callback: (data: unknown) => void): () => void;
  off(channel: string, callback: (data: unknown) => void): void;
  once(channel: string, callback: (data: unknown) => void): void;
  startSession(audioSource: 'system' | 'microphone'): Promise<void>;
  stopSession(): Promise<void>;
  pauseSession(): Promise<void>;
  resumeSession(): Promise<void>;
  updateConfig(config: Record<string, unknown>): Promise<void>;
  triggerSummary(): Promise<void>;
  prepareRecord(): Promise<void>;
  exitControl(action: 'minimize' | 'stop' | 'cancel'): Promise<void>;
  toggleSubtitle(visible: boolean): Promise<void>;
  addFavorite(text: string, noteFileName: string, noteFilePath: string): Promise<void>;
  removeFavorite(id: string): Promise<void>;
  removeFavorites(ids: string[]): Promise<void>;
  getFavorites(): Promise<unknown[]>;
  searchFavorites(query: string): Promise<unknown[]>;
  exportFavorites(ids: string[], savePath: string): Promise<void>;
  submitImprovement(original: string, improved: string, reason: string, context: string): Promise<void>;
  isPersonalDictEnabled(): Promise<boolean>;
  loadDictionaryFile(dictType: string, filePath: string): Promise<void>;
  removeDictionaryFile(dictType: string, filePath: string): Promise<void>;
  getDictionaryEntries(dictType: string): Promise<unknown[]>;
  removeDictionaryEntry(dictType: string, entryId: string): Promise<void>;
  listNotes(dirPath?: string): Promise<unknown[]>;
  readNote(filePath: string): Promise<string>;
  exportAllNotes(savePath: string): Promise<void>;
  selectDirectory(): Promise<string | null>;
  selectFile(filters?: Array<{ name: string; extensions: string[] }>): Promise<string | null>;
  clearData(types: ('notes' | 'favorites' | 'personalDict')[]): Promise<void>;
  loadConfig(): Promise<unknown>;
  saveConfig(config: unknown): Promise<void>;
  log(level: LogLevel, module: string, message: string, data?: unknown): void;
}

function buildAPI(): SynchroLensAPI {
  return {
    on(channel: string, callback: (data: unknown) => void): () => void {
      if (!listenerMap.has(channel)) {
        listenerMap.set(channel, new Set());
      }
      const listeners = listenerMap.get(channel)!;
      listeners.add(callback);
      return () => { listeners.delete(callback); };
    },

    off(channel: string, callback: (data: unknown) => void): void {
      const listeners = listenerMap.get(channel);
      if (listeners) { listeners.delete(callback); }
    },

    once(channel: string, callback: (data: unknown) => void): void {
      const wrappedCallback = (data: unknown) => {
        callback(data);
        const listeners = listenerMap.get(channel);
        if (listeners) { listeners.delete(wrappedCallback); }
      };
      if (!listenerMap.has(channel)) { listenerMap.set(channel, new Set()); }
      listenerMap.get(channel)!.add(wrappedCallback);
    },

    startSession(audioSource) { return ipcRenderer.invoke(IPC_CHANNELS.SESSION_START, { audioSource }); },
    stopSession() { return ipcRenderer.invoke(IPC_CHANNELS.SESSION_STOP); },
    pauseSession() { return ipcRenderer.invoke(IPC_CHANNELS.SESSION_PAUSE); },
    resumeSession() { return ipcRenderer.invoke(IPC_CHANNELS.SESSION_RESUME); },
    updateConfig(config) { return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_UPDATE, config); },
    triggerSummary() { return ipcRenderer.invoke(IPC_CHANNELS.SUMMARY_TRIGGER); },

    prepareRecord() { return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_PREPARE_RECORD); },
    exitControl(action) { return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_EXIT_CONTROL, { action }); },
    toggleSubtitle(visible) { return ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_SUBTITLE, { visible }); },

    addFavorite(text, noteFileName, noteFilePath) { return ipcRenderer.invoke(IPC_CHANNELS.FAVORITE_ADD, { text, noteFileName, noteFilePath }); },
    removeFavorite(id) { return ipcRenderer.invoke(IPC_CHANNELS.FAVORITE_REMOVE, { id }); },
    removeFavorites(ids) { return ipcRenderer.invoke(IPC_CHANNELS.FAVORITE_REMOVE_BATCH, { ids }); },
    getFavorites() { return ipcRenderer.invoke(IPC_CHANNELS.FAVORITE_GET); },
    searchFavorites(query) { return ipcRenderer.invoke(IPC_CHANNELS.FAVORITE_SEARCH, { query }); },
    exportFavorites(ids, savePath) { return ipcRenderer.invoke(IPC_CHANNELS.FAVORITE_EXPORT, { ids, savePath }); },

    submitImprovement(original, improved, reason, context) { return ipcRenderer.invoke(IPC_CHANNELS.IMPROVE_SUBMIT, { original, improved, reason, context }); },
    isPersonalDictEnabled() { return ipcRenderer.invoke(IPC_CHANNELS.PERSONAL_DICT_STATUS); },

    loadDictionaryFile(dictType, filePath) { return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_FILE_LOAD, { dictType, filePath }); },
    removeDictionaryFile(dictType, filePath) { return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_FILE_REMOVE, { dictType, filePath }); },
    getDictionaryEntries(dictType) { return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_ENTRIES_GET, { dictType }); },
    removeDictionaryEntry(dictType, entryId) { return ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_ENTRY_REMOVE, { dictType, entryId }); },

    listNotes(dirPath?) { return ipcRenderer.invoke(IPC_CHANNELS.NOTES_LIST, { dirPath }); },
    readNote(filePath) { return ipcRenderer.invoke(IPC_CHANNELS.NOTES_READ, { filePath }); },
    exportAllNotes(savePath) { return ipcRenderer.invoke(IPC_CHANNELS.NOTES_EXPORT_ALL, { savePath }); },
    selectDirectory() { return ipcRenderer.invoke(IPC_CHANNELS.SELECT_DIRECTORY); },

    clearData(types) { return ipcRenderer.invoke(IPC_CHANNELS.DATA_CLEAR, { types }); },

    loadConfig() { return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_LOAD); },
    saveConfig(config: unknown) { return ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SAVE, config); },

    log(level, module, message, data?) { ipcRenderer.send(LOG_CHANNELS.LOG_SEND, { level, module, message, data }); },
  };
}

contextBridge.exposeInMainWorld('synchrolens', buildAPI());

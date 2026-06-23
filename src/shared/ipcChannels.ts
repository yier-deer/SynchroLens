export const IPC_CHANNELS = {
  STT_PARTIAL: 'stt:partial',
  STT_SENTENCE: 'stt:sentence',
  TRANSLATE_PARTIAL: 'translate:partial',
  TRANSLATE_FINAL: 'translate:final',
  TRANSLATE_CORRECT: 'translate:correct',
  NOTE_SAVED: 'note:saved',
  NOTE_SUMMARY: 'note:summary',
  ENHANCEMENT_STATUS: 'enhancement:status',
  SESSION_STATE_CHANGE: 'session:state-change',

  SESSION_START: 'session:start',
  SESSION_STOP: 'session:stop',
  SESSION_PAUSE: 'session:pause',
  SESSION_RESUME: 'session:resume',
  CONFIG_UPDATE: 'config:update',
  SUMMARY_TRIGGER: 'summary:trigger',
  WINDOW_PREPARE_RECORD: 'window:prepare-record',
  WINDOW_EXIT_CONTROL: 'window:exit-control',
  WINDOW_TOGGLE_SUBTITLE: 'window:toggle-subtitle',

  FAVORITE_ADD: 'favorite:add',
  FAVORITE_REMOVE: 'favorite:remove',
  FAVORITE_REMOVE_BATCH: 'favorite:remove-batch',
  FAVORITE_GET: 'favorite:get',
  FAVORITE_SEARCH: 'favorite:search',
  FAVORITE_EXPORT: 'favorite:export',

  IMPROVE_SUBMIT: 'improve:submit',
  PERSONAL_DICT_STATUS: 'personal-dict:status',

  DICTIONARY_ENTRIES_GET: 'dictionary:entries:get',
  DICTIONARY_ENTRY_REMOVE: 'dictionary:entry:remove',
  DICTIONARY_FILES_LIST: 'dictionary:files:list',
  DICTIONARY_FILE_LOAD: 'dictionary:file:load',
  DICTIONARY_FILE_REMOVE: 'dictionary:file:remove',
  DICTIONARY_FILE_TOGGLE: 'dictionary:file:toggle',

  NOTES_LIST: 'notes:list',
  NOTES_READ: 'notes:read',
  NOTES_EXPORT_ALL: 'notes:export-all',

  DATA_CLEAR: 'data:clear',
  SELECT_DIRECTORY: 'dialog:select-directory',

  CONFIG_LOAD: 'config:load',
  CONFIG_SAVE: 'config:save',
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type MainToRendererChannel =
  | 'stt:partial'
  | 'stt:sentence'
  | 'translate:partial'
  | 'translate:final'
  | 'translate:correct'
  | 'note:saved'
  | 'note:summary'
  | 'enhancement:status'
  | 'session:state-change';

export type RendererToMainChannel =
  | 'session:start'
  | 'session:stop'
  | 'session:pause'
  | 'session:resume'
  | 'config:update'
  | 'summary:trigger';

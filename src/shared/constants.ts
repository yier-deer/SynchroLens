/**
 * Shared runtime constants.
 */

export const AUDIO_CONSTANTS = Object.freeze({
  SAMPLE_RATE: 16000,
  FRAME_SIZE: 1280,
  FRAME_INTERVAL_MS: 40,
  INPUT_SAMPLE_RATE: 48000,
} as const);

export const STT_CONSTANTS = Object.freeze({
  MAX_RETRY_COUNT: 3,
  RETRY_INTERVAL_MS: 2000,
  CONNECTION_TIMEOUT_MS: 10000,
  MAX_SESSION_DURATION_MS: 60000,
  WS_URL: 'wss://iat-api.xfyun.cn/v2/iat',
  RTASR_WS_URL: 'wss://rtasr.xfyun.cn/v1/ws',
  FIRST_PARTIAL_TARGET_MS: 2000,
  FIRST_PARTIAL_P95_TARGET_MS: 3000,
} as const);

export const TRANSLATE_CONSTANTS = Object.freeze({
  CONTEXT_WINDOW_SIZE: 5,
  TRANSLATION_TIMEOUT_MS: 10000,
  MAX_RETRY_COUNT: 3,
  INITIAL_RETRY_INTERVAL_MS: 1000,
  RETRY_BACKOFF_FACTOR: 2,
  MAX_RETRY_INTERVAL_MS: 8000,
  API_BASE_URL: 'https://api.deepseek.com',
  MODEL: 'deepseek-v4-flash',
  TEMPERATURE: 0.3,
} as const);

export const NOTE_CONSTANTS = Object.freeze({
  DEFAULT_SAVE_DIR: 'SynchroLens/Notes',
  AUTO_SAVE_INTERVAL_MS: 5000,
  CORRECTION_BATCH_SIZE: 5,
  WRITE_RETRY_COUNT: 3,
  WRITE_RETRY_INTERVAL_MS: 1000,
} as const);

export const UI_CONSTANTS = Object.freeze({
  MAX_VISIBLE_SENTENCES: 8,
  SUBTITLE_BG_OPACITY: 0.7,
  PANEL_MERGE_DURATION_MS: 300,
  CORRECTION_ANIMATION_MS: 300,
} as const);

export const LOG_CONSTANTS = Object.freeze({
  DEFAULT_LEVEL: 'info',
  LOG_DIR: 'logs',
  FILE_PREFIX: 'synchrolens',
  DATE_PATTERN: 'YYYY-MM-DD',
  MAX_FILE_SIZE_MB: 5,
  RETENTION_DAYS: 7,
} as const);

export const SHORTCUT_CONSTANTS = Object.freeze({
  START_STOP: 'Ctrl+Shift+S',
  PAUSE_RESUME: 'Ctrl+Shift+P',
} as const);

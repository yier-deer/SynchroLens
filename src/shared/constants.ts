/**
 * SynchroLens 业务常量定义
 * 所有跨模块使用的常量集中管理于此，使用 Object.freeze() 确保运行时不可变
 */

/** 音频相关常量 */
export const AUDIO_CONSTANTS = Object.freeze({
  /** 输出采样率（Hz），讯飞 STT 要求 16kHz */
  SAMPLE_RATE: 16000,
  /** 音频帧大小（字节），16kHz * 40ms * 2bytes(16bit) = 1280 */
  FRAME_SIZE: 1280,
  /** 帧间隔（毫秒），对应 40ms 一帧 */
  FRAME_INTERVAL_MS: 40,
  /** 输入设备采样率（Hz），系统默认采集 48kHz */
  INPUT_SAMPLE_RATE: 48000,
} as const);

/** 语音识别（STT）相关常量 */
export const STT_CONSTANTS = Object.freeze({
  /** 最大重连次数 */
  MAX_RETRY_COUNT: 3,
  /** 重连间隔（毫秒） */
  RETRY_INTERVAL_MS: 2000,
  /** 连接超时（毫秒） */
  CONNECTION_TIMEOUT_MS: 10000,
  /** 单次会话最长持续时间（毫秒） */
  MAX_SESSION_DURATION_MS: 60000,
  /** 讯飞 WebSocket 实时转写 API 地址 */
  WS_URL: 'wss://iat-api.xfyun.cn/v2/iat',
} as const);

/** 翻译相关常量 */
export const TRANSLATE_CONSTANTS = Object.freeze({
  /** 上下文窗口大小（句子数），翻译时携带最近 N 句作为上下文 */
  CONTEXT_WINDOW_SIZE: 5,
  /** 单次翻译请求超时（毫秒） */
  TRANSLATION_TIMEOUT_MS: 10000,
  /** 翻译请求最大重试次数 */
  MAX_RETRY_COUNT: 3,
  /** 初始重试间隔（毫秒） */
  INITIAL_RETRY_INTERVAL_MS: 1000,
  /** 退避因子，每次重试间隔乘以该值 */
  RETRY_BACKOFF_FACTOR: 2,
  /** 最大重试间隔（毫秒） */
  MAX_RETRY_INTERVAL_MS: 8000,
  /** DeepSeek API 基础地址 */
  API_BASE_URL: 'https://api.deepseek.com/v1',
  /** 翻译模型名称 */
  MODEL: 'deepseek-chat',
  /** 翻译温度参数，越低越确定 */
  TEMPERATURE: 0.3,
} as const);

/** 笔记相关常量 */
export const NOTE_CONSTANTS = Object.freeze({
  /** 默认笔记保存目录（相对于用户主目录） */
  DEFAULT_SAVE_DIR: 'SynchroLens/Notes',
  /** 自动保存间隔（毫秒） */
  AUTO_SAVE_INTERVAL_MS: 5000,
  /** 纠正批处理大小（句子数） */
  CORRECTION_BATCH_SIZE: 5,
  /** 笔记写入重试次数 */
  WRITE_RETRY_COUNT: 3,
  /** 笔记写入重试间隔（毫秒） */
  WRITE_RETRY_INTERVAL_MS: 1000,
} as const);

/** UI 相关常量 */
export const UI_CONSTANTS = Object.freeze({
  /** 字幕窗口最大可见句子数 */
  MAX_VISIBLE_SENTENCES: 8,
  /** 字幕背景透明度（0-1） */
  SUBTITLE_BG_OPACITY: 0.7,
  /** 面板合并动画时长（毫秒） */
  PANEL_MERGE_DURATION_MS: 300,
  /** 纠正动画时长（毫秒） */
  CORRECTION_ANIMATION_MS: 300,
} as const);

/** 日志相关常量 */
export const LOG_CONSTANTS = Object.freeze({
  /** 默认日志级别 */
  DEFAULT_LEVEL: 'info',
  /** 日志文件目录 */
  LOG_DIR: 'logs',
  /** 日志文件名前缀 */
  FILE_PREFIX: 'synchrolens',
  /** 日志文件日期格式（按天轮转） */
  DATE_PATTERN: 'YYYY-MM-DD',
  /** 日志文件最大大小（MB） */
  MAX_FILE_SIZE_MB: 5,
  /** 日志文件保留天数 */
  RETENTION_DAYS: 7,
} as const);

/** 快捷键相关常量 */
export const SHORTCUT_CONSTANTS = Object.freeze({
  /** 开始 / 停止会话快捷键 */
  START_STOP: 'Ctrl+Shift+S',
  /** 暂停 / 恢复会话快捷键 */
  PAUSE_RESUME: 'Ctrl+Shift+P',
} as const);

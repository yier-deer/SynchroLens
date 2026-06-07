/**
 * SynchroLens 核心类型定义
 * 所有跨进程通信的类型集中定义于此，被主进程和渲染进程共同引用
 */

// ===== 核心数据结构 =====

/** STT 语音识别结果 */
export interface STTResult {
  /** 句子唯一标识 */
  sentenceId: string;
  /** 识别文本内容 */
  text: string;
  /** 是否为最终确认结果（false 表示中间片段） */
  isFinal: boolean;
  /** 时间戳（毫秒，epoch time） */
  timestamp: number;
}

/** 翻译结果 */
export interface TranslationResult {
  /** 对应的句子唯一标识 */
  sentenceId: string;
  /** 原文文本 */
  original: string;
  /** 译文文本 */
  translation: string;
  /** 是否为最终确认结果 */
  isFinal: boolean;
  /** 纠正记录列表 */
  corrections: Correction[];
}

/** 纠正记录 */
export interface Correction {
  /** 纠正前的文本 */
  from: string;
  /** 纠正后的文本 */
  to: string;
  /** 纠正原因说明 */
  reason: string;
  /** 纠正发生的时间戳（毫秒，epoch time） */
  timestamp: number;
}

/** 翻译会话 */
export interface Session {
  /** 会话唯一标识 */
  id: string;
  /** 会话开始时间（毫秒，epoch time） */
  startTime: number;
  /** 会话结束时间（毫秒，epoch time），进行中为 undefined */
  endTime?: number;
  /** 音频来源类型 */
  audioSource: 'system' | 'microphone' | 'file';
  /** 会话中的翻译结果列表 */
  sentences: TranslationResult[];
  /** 关联的笔记文件路径 */
  notePath?: string;
  /** 会话摘要 */
  summary?: string;
}

// ===== 应用配置 =====

/** 应用完整配置 */
export interface AppConfig {
  general: GeneralConfig;
  stt: STTConfig;
  translation: TranslationConfig;
  vector: VectorConfig;
  note: NoteConfig;
  audio: AudioConfig;
}

/** 通用设置 */
export interface GeneralConfig {
  /** 界面语言 */
  language: 'zh-CN' | 'en-US';
  /** 主题 */
  theme: 'light' | 'dark' | 'system';
  /** 最小化到系统托盘 */
  minimizeToTray: boolean;
  /** 开机自启 */
  autoStart: boolean;
  /** 字幕显示双语（原文+译文） */
  showBilingual: boolean;
}

/** STT 语音识别设置 */
export interface STTConfig {
  /** 语音识别服务提供商 */
  provider: 'xfyun' | 'whisper-local' | 'whisper-api';
  /** 识别语言 */
  language: string;
  /** API 密钥 */
  apiKey?: string;
  /** API Secret（用于签名） */
  apiSecret?: string;
  /** 讯飞应用 AppID */
  appId?: string;
  /** API 端点 */
  apiEndpoint?: string;
}

/** 翻译设置 */
export interface TranslationConfig {
  /** 翻译服务提供商 */
  provider: 'deepseek' | 'openai' | 'local';
  /** 目标语言 */
  targetLanguage: string;
  /** API 密钥 */
  apiKey?: string;
  /** API 端点 */
  apiEndpoint?: string;
  /** 翻译模型名称 */
  model?: string;
  /** 是否启用上下文感知纠正 */
  contextCorrection: boolean;
  /** 上下文窗口大小（句子数） */
  contextWindowSize: number;
}

/** 向量模型设置 */
export interface VectorConfig {
  apiEndpoint?: string;
  apiKey?: string;
  model?: string;
}

/** 笔记设置 */
export interface NoteConfig {
  /** 笔记保存根目录 */
  saveDir: string;
  /** 是否自动保存 */
  autoSave: boolean;
  /** 自动保存间隔（毫秒） */
  autoSaveInterval: number;
  /** 是否自动生成摘要 */
  autoSummary: boolean;
  /** 摘要触发阈值（句子数） */
  summaryThreshold: number;
}

/** 音频设置 */
export interface AudioConfig {
  /** 音频来源 */
  source: 'system' | 'microphone' | 'file';
  /** 系统音频捕获方式 */
  systemAudioBackend: 'wasapi' | 'pulseaudio' | 'coreaudio';
  /** 麦克风设备 ID */
  microphoneDeviceId?: string;
  /** 采样率 */
  sampleRate: number;
  /** 是否启用降噪 */
  noiseReduction: boolean;
}

// ===== IPC 事件载荷类型 =====

/** Main → Renderer：STT 中间识别片段 */
export interface STTPartialPayload {
  sentenceId: string;
  text: string;
  isFinal: false;
}

/** Main → Renderer：STT 完整句子确认 */
export interface STTSentencePayload {
  sentenceId: string;
  text: string;
  timestamp: number;
}

/** Main → Renderer：翻译流式片段 */
export interface TranslatePartialPayload {
  sentenceId: string;
  translation: string;
}

/** Main → Renderer：翻译最终结果 */
export interface TranslateFinalPayload {
  sentenceId: string;
  original: string;
  translation: string;
  corrections: Correction[];
}

/** Main → Renderer：翻译纠正通知 */
export interface TranslateCorrectPayload {
  sentenceId: string;
  oldTranslation: string;
  newTranslation: string;
  reason: string;
}

/** Main → Renderer：笔记已保存通知 */
export interface NoteSavedPayload {
  filePath: string;
}

/** Main → Renderer：摘要已生成通知 */
export interface NoteSummaryPayload {
  summary: string;
}

/** Renderer → Main：启动会话请求 */
export interface SessionStartPayload {
  audioSource: 'system' | 'microphone';
}

/** Renderer → Main：配置更新请求 */
export interface ConfigUpdatePayload {
  [key: string]: unknown;
}

// ===== 收藏与词典数据类型 =====

/** 收藏条目 */
export interface Favorite {
  /** 收藏唯一标识 */
  id: string;
  /** 收藏的文本内容 */
  text: string;
  /** 来源笔记文件名 */
  noteFileName: string;
  /** 来源笔记完整路径 */
  noteFilePath: string;
  /** 收藏时间（ISO 8601 字符串） */
  createdAt: string;
}

/** 笔记文件树节点 */
export interface NoteTreeItem {
  /** 文件/目录名称 */
  name: string;
  /** 完整路径 */
  path: string;
  /** 类型 */
  type: 'directory' | 'file';
  /** 子节点（仅目录有） */
  children?: NoteTreeItem[];
  /** 修改时间（毫秒，epoch time） */
  modifiedAt?: number;
}

/** 个人词典条目 */
export interface DictEntry {
  /** 条目唯一标识 */
  id: string;
  /** 原文文本 */
  source: string;
  /** 改进后的译文 */
  target: string;
  /** 改进意见说明 */
  improvement: string;
  /** 来源笔记文件名 */
  sourceNote: string;
  /** 收录时间（ISO 8601 字符串） */
  createdAt: string;
}

/** 改进提交载荷 */
export interface ImprovementPayload {
  /** 原始译文 */
  original: string;
  /** 用户改进版 */
  improved: string;
  /** 改进意见 */
  reason: string;
  /** 上下文（原文+前后句） */
  context: string;
}

/** 外部词典文件信息 */
export interface DictFile {
  /** 文件名 */
  name: string;
  /** 文件路径 */
  path: string;
  /** 条目数量 */
  count: number;
  /** 是否启用 */
  enabled: boolean;
}

// ===== 枚举与联合类型 =====

/** 会话状态 */
export type SessionState = 'idle' | 'running' | 'paused' | 'stopped';

// ===== 辅助类型 =====

/** 音频设备信息 */
export interface DeviceInfo {
  /** 设备唯一标识 */
  deviceId: string;
  /** 设备显示名称 */
  label: string;
}

/** 翻译对（原文+译文），用于上下文窗口和纠正检测 */
export interface TranslationPair {
  /** 句子唯一标识 */
  sentenceId: string;
  /** 原文文本 */
  original: string;
  /** 译文文本 */
  translation: string;
}

/** 纠正检测结果 */
export interface CorrectionResult {
  /** 句子唯一标识 */
  sentenceId: string;
  /** 纠正前的文本 */
  from: string;
  /** 纠正后的文本 */
  to: string;
  /** 纠正原因说明 */
  reason: string;
}

// ===== 类型守卫函数 =====

/**
 * 判断一个值是否为有效的 STTResult 对象
 * @param value - 待检查的值
 * @returns 是否为 STTResult
 */
export function isSTTResult(value: unknown): value is STTResult {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.sentenceId === 'string' &&
    typeof obj.text === 'string' &&
    typeof obj.isFinal === 'boolean' &&
    typeof obj.timestamp === 'number'
  );
}

/**
 * 判断一个值是否为有效的 TranslationResult 对象
 * @param value - 待检查的值
 * @returns 是否为 TranslationResult
 */
export function isTranslationResult(value: unknown): value is TranslationResult {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.sentenceId === 'string' &&
    typeof obj.original === 'string' &&
    typeof obj.translation === 'string' &&
    typeof obj.isFinal === 'boolean' &&
    Array.isArray(obj.corrections)
  );
}

/**
 * 判断一个值是否为有效的 Correction 对象
 * @param value - 待检查的值
 * @returns 是否为 Correction
 */
export function isCorrection(value: unknown): value is Correction {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.from === 'string' &&
    typeof obj.to === 'string' &&
    typeof obj.reason === 'string' &&
    typeof obj.timestamp === 'number'
  );
}

/**
 * 判断一个值是否为有效的 Session 对象
 * @param value - 待检查的值
 * @returns 是否为 Session
 */
export function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const validSources = ['system', 'microphone', 'file'];
  return (
    typeof obj.id === 'string' &&
    typeof obj.startTime === 'number' &&
    validSources.includes(obj.audioSource as string) &&
    Array.isArray(obj.sentences)
  );
}

/**
 * 判断一个值是否为有效的 DeviceInfo 对象
 * @param value - 待检查的值
 * @returns 是否为 DeviceInfo
 */
export function isDeviceInfo(value: unknown): value is DeviceInfo {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.deviceId === 'string' && typeof obj.label === 'string';
}

/**
 * 判断一个值是否为有效的 SessionState
 * @param value - 待检查的值
 * @returns 是否为 SessionState
 */
export function isSessionState(value: unknown): value is SessionState {
  const validStates: SessionState[] = ['idle', 'running', 'paused', 'stopped'];
  return typeof value === 'string' && validStates.includes(value as SessionState);
}

// ===== 默认配置常量 =====

/** 应用默认配置 */
export const DEFAULT_CONFIG: AppConfig = {
  general: {
    language: 'zh-CN',
    theme: 'system',
    minimizeToTray: true,
    autoStart: false,
    showBilingual: true,
  },
  stt: {
    provider: 'xfyun',
    language: 'zh_cn',
  },
  translation: {
    provider: 'deepseek',
    targetLanguage: 'zh-CN',
    contextCorrection: true,
    contextWindowSize: 5,
    apiEndpoint: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
  },
  vector: {
    apiEndpoint: 'https://api.deepseek.com',
    model: 'deepseek-embedding',
  },
  note: {
    saveDir: '',
    autoSave: true,
    autoSaveInterval: 5000,
    autoSummary: true,
    summaryThreshold: 20,
  },
  audio: {
    source: 'system',
    systemAudioBackend: 'wasapi',
    sampleRate: 16000,
    noiseReduction: false,
  },
};

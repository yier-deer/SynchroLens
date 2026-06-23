export interface STTResult {
  sentenceId: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

export interface TranslationResult {
  sentenceId: string;
  original: string;
  translation: string;
  isFinal: boolean;
  corrections: Correction[];
  constraints?: TranslationConstraint[];
  error?: string;
}

export interface Correction {
  from: string;
  to: string;
  reason: string;
  timestamp: number;
}

export interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  audioSource: 'system' | 'microphone' | 'file';
  sentences: TranslationResult[];
  notePath?: string;
  summary?: string;
}

export interface AppConfig {
  general: GeneralConfig;
  stt: STTConfig;
  translation: TranslationConfig;
  llm: LLMConfig;
  vector: VectorConfig;
  note: NoteConfig;
  enhancement: EnhancementConfig;
  audio: AudioConfig;
}

export interface GeneralConfig {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark' | 'system';
  minimizeToTray: boolean;
  autoStart: boolean;
  showBilingual: boolean;
  cardStyle: '暗夜蓝' | '深空灰' | '墨绿';
}

export interface STTConfig {
  provider: 'xfyun-rtasr' | 'xfyun-iat' | 'whisper-local' | 'whisper-api';
  language: string;
  apiKey?: string;
  apiSecret?: string;
  appId?: string;
  apiEndpoint?: string;
}

export interface TranslationConfig {
  provider: 'nmt' | 'deepseek' | 'openai' | 'local' | 'tencent-tmt';
  targetLanguage: string;
  apiKey?: string;
  apiEndpoint?: string;
  model?: string;
  contextCorrection: boolean;
  contextWindowSize: number;
  tencent: TencentTMTConfig;
}

export interface TencentTMTConfig {
  enabled: boolean;
  secretId?: string;
  secretKey?: string;
  secretKeySaved?: boolean;
  region: string;
  projectId: number;
  sourceLanguage: 'auto' | 'zh' | 'en' | 'ja' | 'ko';
}

export interface LLMConfig {
  provider: 'deepseek' | 'openai' | 'local';
  apiEndpoint?: string;
  apiKey?: string;
  model?: string;
}

export interface VectorConfig {
  apiEndpoint?: string;
  apiKey?: string;
  model?: string;
}

export interface NoteConfig {
  saveDir: string;
  autoSave: boolean;
  autoSaveInterval: number;
  autoSummary: boolean;
  summaryThreshold: number;
}

export interface EnhancementConfig {
  enabled: boolean;
  summaryEnabled: boolean;
  correctionEnabled: boolean;
  recommendationEnabled: boolean;
}

export interface AudioConfig {
  source: 'system' | 'microphone' | 'file';
  systemAudioBackend: 'wasapi' | 'pulseaudio' | 'coreaudio';
  microphoneDeviceId?: string;
  sampleRate: number;
  noiseReduction: boolean;
}

export interface STTPartialPayload extends STTResult {
  isFinal: false;
}

export interface STTSentencePayload extends STTResult {
  isFinal: true;
}

export interface TranslatePartialPayload {
  sentenceId: string;
  original: string;
  translation: string;
}

export interface TranslateFinalPayload {
  sentenceId: string;
  original: string;
  translation: string;
  corrections: Correction[];
  error?: string;
}

export interface TranslateCorrectPayload {
  sentenceId: string;
  oldTranslation: string;
  newTranslation: string;
  reason: string;
}

export interface NoteSavedPayload {
  filePath: string;
}

export interface NoteSummaryPayload {
  summary: string;
}

export interface EnhancementStatusPayload {
  kind: 'summary' | 'correction' | 'recommendation';
  state: 'idle' | 'running' | 'completed' | 'failed';
  sessionId: string;
  summary?: string;
  corrections?: Correction[];
  recommendations?: string[];
  error?: string;
}

export interface SessionStartPayload {
  audioSource: 'system' | 'microphone';
}

export interface ConfigUpdatePayload {
  [key: string]: unknown;
}

export interface Favorite {
  id: string;
  text: string;
  noteFileName: string;
  noteFilePath: string;
  createdAt: string;
}

export interface NoteTreeItem {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children?: NoteTreeItem[];
  modifiedAt?: number;
}

export type DictType = 'language' | 'domain' | 'personal';

export interface DictEntry {
  source: string;
  target: string;
  id?: string;
  improvement?: string;
  sourceNote?: string;
  createdAt?: string;
}

export interface PersonalDictEntry extends DictEntry {
  id: string;
  improvement: string;
  sourceNote: string;
  createdAt: string;
}

export interface ImprovementPayload {
  original: string;
  improved: string;
  reason: string;
  context: string;
}

export interface DictFile {
  name: string;
  path: string;
  count: number;
  enabled: boolean;
}

export interface DictionaryFileInfo {
  name: string;
  filePath: string;
  dictType: Exclude<DictType, 'personal'>;
  count: number;
  enabled: boolean;
}

export interface PersonalDictStatus {
  available: boolean;
  hasEntries: boolean;
  embeddingReady: boolean;
}

export interface TranslationConstraint {
  source: string;
  target: string;
  sourceType: DictType;
  priority: number;
  matchType: 'exact' | 'similar';
  enforceMode: 'term' | 'sentence';
  entryId?: string;
  filePath?: string;
  score?: number;
}

export type KnowledgeSourceType =
  | 'language-dictionary'
  | 'domain-dictionary'
  | 'personal-dictionary'
  | 'translation-memory';

export type KnowledgeConsumer =
  | 'translation-constraint'
  | 'enhancement-recommendation';

export interface KnowledgeHit {
  id: string;
  query: string;
  source: string;
  target: string;
  sourceType: KnowledgeSourceType;
  matchType: 'exact' | 'similar';
  priority: number;
  score?: number;
  entryId?: string;
  filePath?: string;
  notePath?: string;
  consumers: KnowledgeConsumer[];
}

export interface KnowledgeRetrievalResult {
  query: string;
  hits: KnowledgeHit[];
  durationMs: number;
  degraded: boolean;
  error?: string;
}

export type SessionState =
  | 'idle'
  | 'running'
  | 'listening'
  | 'recognizing'
  | 'reconnecting'
  | 'paused'
  | 'stopped'
  | 'error';

export interface DeviceInfo {
  deviceId: string;
  label: string;
}

export interface TranslationPair {
  sentenceId: string;
  original: string;
  translation: string;
}

export interface CorrectionResult {
  sentenceId: string;
  from: string;
  to: string;
  reason: string;
}

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

export function isDeviceInfo(value: unknown): value is DeviceInfo {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.deviceId === 'string' && typeof obj.label === 'string';
}

export function isSessionState(value: unknown): value is SessionState {
  const validStates: SessionState[] = [
    'idle',
    'running',
    'listening',
    'recognizing',
    'reconnecting',
    'paused',
    'stopped',
    'error',
  ];
  return typeof value === 'string' && validStates.includes(value as SessionState);
}

export const DEFAULT_CONFIG: AppConfig = {
  general: {
    language: 'zh-CN',
    theme: 'system',
    minimizeToTray: true,
    autoStart: false,
    showBilingual: false,
    cardStyle: '暗夜蓝',
  },
  stt: {
    provider: 'xfyun-rtasr',
    language: 'zh_cn',
  },
  translation: {
    provider: 'tencent-tmt',
    targetLanguage: 'zh-CN',
    contextCorrection: false,
    contextWindowSize: 5,
    apiEndpoint: 'http://127.0.0.1:8765',
    model: 'tencent-tmt',
    tencent: {
      enabled: true,
      region: 'ap-guangzhou',
      projectId: 0,
      sourceLanguage: 'auto',
      secretKeySaved: false,
    },
  },
  llm: {
    provider: 'deepseek',
    apiEndpoint: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
  },
  vector: {
    apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-embedding-vision-251215',
  },
  note: {
    saveDir: '',
    autoSave: true,
    autoSaveInterval: 5000,
    autoSummary: true,
    summaryThreshold: 20,
  },
  enhancement: {
    enabled: false,
    summaryEnabled: true,
    correctionEnabled: true,
    recommendationEnabled: true,
  },
  audio: {
    source: 'system',
    systemAudioBackend: 'wasapi',
    sampleRate: 16000,
    noiseReduction: false,
  },
};

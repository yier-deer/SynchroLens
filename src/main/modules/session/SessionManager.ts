/**
 * 会话生命周期管理器
 * 负责创建/启动/暂停/停止翻译会话，编排各管道模块的协作
 */

import { createLogger } from '../../utils/logger';
import type { Session, SessionState, AppConfig, STTResult, TranslationResult } from '../../../shared/types';

/** 音频采集模块接口 */
interface IAudioCapture {
  start(source: 'system' | 'microphone', deviceId?: string): Promise<void>;
  stop(): void;
  onData(callback: (pcmBuffer: Int16Array) => void): () => void;
  get isRunning(): boolean;
}

/** STT 客户端接口 */
interface ISTTClient {
  connect(config: { appId: string; apiKey: string; apiSecret: string }): void;
  sendAudio(pcmChunk: Int16Array): void;
  disconnect(): void;
  onResult(callback: (text: string, isFinal: boolean, sentenceId: string) => void): void;
  get isConnected(): boolean;
  language?: string;
}

/** 翻译客户端接口 */
interface ITranslator {
  translate(text: string, context: { original: string; translation: string }[]): AsyncGenerator<string>;
  buildContextWindow(recentTranslations: { original: string; translation: string }[], maxCount: number): string;
  translateFull(text: string, context: { original: string; translation: string }[]): Promise<string>;
  generateSummary(sentences: TranslationResult[]): Promise<string>;
  setApiKey(key: string): void;
  model?: string;
  targetLanguage?: string;
}

/** 笔记写入模块接口 */
interface INoteWriter {
  createNoteFile(session: Session): string;
  appendEntry(filePath: string, original: string, translation: string, timestamp: number): Promise<void>;
  appendSummary(filePath: string, summary: string): Promise<void>;
  writeHeader(filePath: string, session: { startTime: number; audioSource: string }, sentenceCount: number, duration: string): Promise<void>;
}

/** 纠正检测模块接口 */
interface ICorrectionDetector {
  checkConsistency(translations: { sentenceId: string; original: string; translation: string }[]): Promise<{ sentenceId: string; from: string; to: string; reason: string }[]>;
  shouldCheck(sentenceCount: number): boolean;
  get currentSentenceCount(): number;
}

/** 模块依赖注册表 */
export interface SessionDependencies {
  audioCapture: IAudioCapture;
  sttClient: ISTTClient;
  translator: ITranslator;
  noteWriter: INoteWriter;
  correctionDetector: ICorrectionDetector;
}

/** 事件回调类型 */
export type SessionEventCallback = (sessionId: string, data?: unknown) => void;

/** 内部会话记录 */
interface ActiveSession {
  session: Session;
  unsubscribeAudio: (() => void) | null;
}

/** 生成唯一会话 ID */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 会话生命周期管理器
 */
export class SessionManager {
  private l = createLogger('SessionManager');
  private deps: SessionDependencies;
  private activeSession: ActiveSession | null = null;
  private config: AppConfig | null = null;
  private sentenceCount = 0;
  private onStateChangeCallbacks: Set<SessionEventCallback> = new Set();
  private onSTTPartialCallbacks: Set<SessionEventCallback> = new Set();
  private onTranslatePartialCallbacks: Set<SessionEventCallback> = new Set();
  private onTranslateFinalCallbacks: Set<SessionEventCallback> = new Set();
  private onNoteSaved: SessionEventCallback | null = null;
  private onSummary: SessionEventCallback | null = null;

  constructor(deps: SessionDependencies) {
    this.deps = deps;
  }

  /** 创建新会话 */
  createSession(audioSource: 'system' | 'microphone'): Session {
    const id = generateSessionId();
    const session: Session = {
      id,
      startTime: Date.now(),
      audioSource,
      sentences: [],
    };
    this.l.info('会话已创建', { id, audioSource });
    return session;
  }

  /** 启动翻译会话 */
  startSession(session: Session): void {
    this.l.info('会话已启动', { id: session.id });

    try {
      const appId = process.env.XFYUN_APP_ID || '';
      const apiKey = process.env.XFYUN_API_KEY || '';
      const apiSecret = process.env.XFYUN_API_SECRET || '';
      this.deps.sttClient.connect({ appId, apiKey, apiSecret });

      this.deps.audioCapture.start(session.audioSource as 'system' | 'microphone');

      // 2. 建立管线：Audio → STT
      const unsubscribe = this.deps.audioCapture.onData((pcmBuffer) => {
        this.deps.sttClient.sendAudio(pcmBuffer);
      });

      // 3. STT 结果 → 翻译
      this.deps.sttClient.onResult((text, isFinal, sentenceId) => {
        if (!isFinal) {
          for (const cb of this.onSTTPartialCallbacks) {
            cb(session.id, { sentenceId, text, isFinal: false });
          }
          return;
        }

        // 最终结果 → 触发翻译
        const context = session.sentences.slice(-5).filter((s) => s.isFinal);
        this.translateSentence(session, sentenceId, text, context);
      });

      this.activeSession = {
        session: { ...session, sentences: [...session.sentences] },
        unsubscribeAudio: unsubscribe,
      };

      this.sentenceCount = 0;

      for (const cb of this.onStateChangeCallbacks) {
        cb(session.id, 'running');
      }
    } catch (err) {
      this.l.error('会话启动失败', { error: (err as Error).message });
    }
  }

  /** 暂停会话 */
  pauseSession(): void {
    if (this.activeSession) {
      this.l.info('会话已暂停', { id: this.activeSession.session.id });
      this.deps.audioCapture.stop();
      for (const cb of this.onStateChangeCallbacks) {
        cb(this.activeSession.session.id, 'paused');
      }
    }
  }

  /** 恢复会话 */
  resumeSession(): void {
    if (this.activeSession) {
      this.l.info('会话已恢复', { id: this.activeSession.session.id });
      const source = this.activeSession.session.audioSource;
      this.deps.audioCapture.start(source as 'system' | 'microphone');
      for (const cb of this.onStateChangeCallbacks) {
        cb(this.activeSession.session.id, 'running');
      }
    }
  }

  /** 结束会话 */
  async endSession(): Promise<void> {
    if (!this.activeSession) return;

    this.l.info('会话已结束', { id: this.activeSession.session.id });

    this.deps.audioCapture.stop();
    this.deps.sttClient.disconnect();

    if (this.activeSession.unsubscribeAudio) {
      this.activeSession.unsubscribeAudio();
    }

    this.activeSession.session.endTime = Date.now();

    for (const cb of this.onStateChangeCallbacks) {
      cb(this.activeSession.session.id, 'stopped');
    }

    this.activeSession = null;
    this.sentenceCount = 0;
  }

  /** 获取会话状态 */
  getSessionState(): SessionState {
    if (!this.activeSession) return 'idle';
    if (this.deps.audioCapture.isRunning) return 'running';
    return 'paused';
  }

  /** 获取当前活跃会话 */
  get currentSession(): Session | null {
    return this.activeSession ? this.activeSession.session : null;
  }

  /** 注册状态变更回调 */
  onSessionStateChange(callback: SessionEventCallback): () => void {
    this.onStateChangeCallbacks.add(callback);
    return () => { this.onStateChangeCallbacks.delete(callback); };
  }

  /** 注册 STT 中间结果回调 */
  onSessionSTTPartial(callback: SessionEventCallback): () => void {
    this.onSTTPartialCallbacks.add(callback);
    return () => { this.onSTTPartialCallbacks.delete(callback); };
  }

  /** 注册翻译流式结果回调 */
  onSessionTranslatePartial(callback: SessionEventCallback): () => void {
    this.onTranslatePartialCallbacks.add(callback);
    return () => { this.onTranslatePartialCallbacks.delete(callback); };
  }

  /** 注册翻译最终结果回调 */
  onSessionTranslateFinal(callback: SessionEventCallback): () => void {
    this.onTranslateFinalCallbacks.add(callback);
    return () => { this.onTranslateFinalCallbacks.delete(callback); };
  }

  /** 触发摘要生成 */
  async triggerSummary(): Promise<void> {
    if (!this.activeSession) return;

    this.l.info('触发摘要生成');

    try {
      const finalSentences = this.activeSession.session.sentences.filter((s) => s.isFinal);
      if (finalSentences.length === 0) return;

      const summary = await this.deps.translator.generateSummary(finalSentences);
      this.activeSession.session.summary = summary;

      if (this.activeSession.session.notePath) {
        await this.deps.noteWriter.appendSummary(this.activeSession.session.notePath, summary);
      }

      if (this.onSummary) {
        this.onSummary(this.activeSession.session.id, summary);
      }
    } catch (err) {
      this.l.error('摘要生成失败', { error: (err as Error).message });
    }
  }

  /** 更新配置 */
  updateConfig(config: Partial<AppConfig>): void {
    this.config = { ...this.config, ...config } as AppConfig;
    if (config.stt?.appId) process.env.XFYUN_APP_ID = config.stt.appId;
    if (config.stt?.apiKey) process.env.XFYUN_API_KEY = config.stt.apiKey;
    if (config.stt?.apiSecret) process.env.XFYUN_API_SECRET = config.stt.apiSecret;
    if (config.stt?.language) this.deps.sttClient['language'] = config.stt.language;
    if (config.translation?.apiKey) {
      process.env.DEEPSEEK_API_KEY = config.translation.apiKey;
      this.deps.translator.setApiKey(config.translation.apiKey);
    }
    if (config.translation?.model) this.deps.translator['model'] = config.translation.model;
    if (config.translation?.targetLanguage) this.deps.translator['targetLanguage'] = config.translation.targetLanguage;
  }

  /**
   * 执行单句翻译流程
   * 流式翻译 → 中间结果推送 → 最终结果写入笔记 → 纠正检测
   */
  private async translateSentence(
    session: Session,
    sentenceId: string,
    text: string,
    context: { original: string; translation: string }[],
  ): Promise<void> {
    const tempResult: TranslationResult = {
      sentenceId,
      original: text,
      translation: '',
      isFinal: false,
      corrections: [],
    };

    try {
      let fullTranslation = '';
      for await (const token of this.deps.translator.translate(text, context)) {
        fullTranslation += token;
        for (const cb of this.onTranslatePartialCallbacks) {
          cb(session.id, { sentenceId, translation: fullTranslation });
        }
      }

      tempResult.translation = fullTranslation || text;
      tempResult.isFinal = true;

      this.l.info('句子翻译完成', { sentenceId, original: text.substring(0, 50) });

      // 追加到会话记录
      session.sentences.push(tempResult);
      this.sentenceCount++;

      // 写入笔记（如果已有 notePath）
      if (session.notePath) {
        await this.deps.noteWriter.appendEntry(
          session.notePath,
          text,
          tempResult.translation,
          Date.now(),
        );
      }

      // 通知最终翻译结果
      for (const cb of this.onTranslateFinalCallbacks) {
        cb(session.id, {
          sentenceId: tempResult.sentenceId,
          original: tempResult.original,
          translation: tempResult.translation,
          corrections: tempResult.corrections,
        });
      }

      // 纠正检测
      if (this.deps.correctionDetector.shouldCheck(1)) {
        const recentTranslations = session.sentences.slice(-5);
        const corrections = await this.deps.correctionDetector.checkConsistency(recentTranslations);
        if (corrections.length > 0 && session.notePath) {
          for (const corr of corrections) {
            await this.deps.noteWriter.appendEntry(
              session.notePath,
              '',
              `纠正: ${corr.from} → ${corr.to}`,
              Date.now(),
            );
          }
        }
      }
    } catch (err) {
      this.l.error('句子翻译失败', { sentenceId, error: (err as Error).message });
      tempResult.translation = text;
      tempResult.isFinal = true;
      session.sentences.push(tempResult);
      this.sentenceCount++;
      for (const cb of this.onTranslateFinalCallbacks) {
        cb(session.id, {
          sentenceId: tempResult.sentenceId,
          original: tempResult.original,
          translation: tempResult.translation,
          corrections: tempResult.corrections,
          error: (err as Error).message,
        });
      }
    }
  }
}

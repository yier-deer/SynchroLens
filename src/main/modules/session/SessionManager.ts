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
  /** 当前句子的累积文本（跨 STT 断连保持） */
  private partialCache = { text: '', sentenceId: '', lastUpdate: 0 };
  /** 上次触发翻译的时间 */
  private lastTranslationTime = 0;
  /** 周期性翻译定时器 */
  private translationTimer: ReturnType<typeof setInterval> | null = null;
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
  async startSession(session: Session): Promise<void> {
    this.l.info('会话启动中', { id: session.id });

    try {
      const appId = process.env.XFYUN_APP_ID || '';
      const apiKey = process.env.XFYUN_API_KEY || '';
      const apiSecret = process.env.XFYUN_API_SECRET || '';
      this.deps.sttClient.connect({ appId, apiKey, apiSecret });

      try {
        await this.deps.audioCapture.start(session.audioSource as 'system' | 'microphone');
      } catch (audioErr) {
        this.l.error('音频采集启动失败，断开 STT', { error: (audioErr as Error).message });
        this.deps.sttClient.disconnect();
        throw audioErr;
      }

      // 2. 建立管线：Audio → STT
      const unsubscribe = this.deps.audioCapture.onData((pcmBuffer) => {
        this.deps.sttClient.sendAudio(pcmBuffer);
      });

      // 3. STT 结果 → 累积 + 翻译
      this.deps.sttClient.onResult((text, isFinal, sentenceId) => {
        if (!isFinal) {
          // 累积到缓存中
          if (text) {
            this.partialCache.text += text;
            this.partialCache.sentenceId = sentenceId;
            this.partialCache.lastUpdate = Date.now();
          }
          for (const cb of this.onSTTPartialCallbacks) {
            cb(session.id, { sentenceId, text: this.partialCache.text, isFinal: false });
          }
          return;
        }

        // 如果是 isFinal 或定时器触发 → 翻译累积文本
        const fullText = text || this.partialCache.text;
        if (fullText.trim()) {
          const context = session.sentences.slice(-5).filter((s) => s.isFinal);
          this.translateSentence(session, sentenceId || this.partialCache.sentenceId, fullText.trim(), context);
          this.partialCache = { text: '', sentenceId: '', lastUpdate: 0 };
        }
      });

      this.activeSession = {
        session: { ...session, sentences: [...session.sentences] },
        unsubscribeAudio: unsubscribe,
      };

      this.sentenceCount = 0;

      // 周期性扫描翻译：每 1.5s 检查是否有累积文本可提交
      this.translationTimer = setInterval(() => {
        if (!this.activeSession) return;
        const text = this.partialCache.text.trim();
        if (!text || text.length < 3) return;
        const elapsed = Date.now() - this.partialCache.lastUpdate;
        const sinceLast = Date.now() - this.lastTranslationTime;
        // 文本在增长但超过 1.5s 无更新 → 触发翻译
        if (elapsed >= 1500 && sinceLast >= 2000) {
          this.l.info('周期触发翻译', { text: text.substring(0, 60), elapsed, sinceLast });
          const ctx = this.activeSession.session.sentences.slice(-5).filter((s) => s.isFinal);
          this.translateSentence(this.activeSession.session, this.partialCache.sentenceId, text, ctx);
          this.partialCache = { text: '', sentenceId: '', lastUpdate: 0 };
        }
      }, 1500);

      for (const cb of this.onStateChangeCallbacks) {
        cb(session.id, 'running');
      }

      this.l.info('会话已启动', { id: session.id });
    } catch (err) {
      this.l.error('会话启动失败', { error: (err as Error).message });
      throw err;
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
    if (!this.activeSession) {
      this.l.warn('endSession 被调用但没有活跃会话');
      return;
    }

    this.l.info('会话结束中', { id: this.activeSession.session.id });

    if (this.translationTimer) {
      clearInterval(this.translationTimer);
      this.translationTimer = null;
    }

    // flush 剩余累积文本
    const remaining = this.partialCache.text.trim();
    if (remaining.length >= 3) {
      this.l.info('结束前 flush 剩余句', { text: remaining.substring(0, 60) });
      const ctx = this.activeSession.session.sentences.slice(-5).filter((s) => s.isFinal);
      await this.translateSentence(this.activeSession.session, this.partialCache.sentenceId, remaining, ctx);
    }
    this.partialCache = { text: '', sentenceId: '', lastUpdate: 0 };

    try {
      this.deps.audioCapture.stop();
      this.l.debug('音频已停止');
    } catch (err) {
      this.l.error('停止音频采集失败', { error: (err as Error).message });
    }

    try {
      this.deps.sttClient.disconnect();
      this.l.debug('STT 已断开');
    } catch (err) {
      this.l.error('断开 STT 失败', { error: (err as Error).message });
    }

    if (this.activeSession.unsubscribeAudio) {
      this.activeSession.unsubscribeAudio();
    }

    this.activeSession.session.endTime = Date.now();

    for (const cb of this.onStateChangeCallbacks) {
      cb(this.activeSession.session.id, 'stopped');
    }

    this.l.info('会话已结束', { id: this.activeSession.session.id, sentenceCount: this.sentenceCount });
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
    if (config.stt?.language) {
      this.deps.sttClient.language = config.stt.language;
      if (typeof (this.deps.sttClient as any).setLanguage === 'function') {
        (this.deps.sttClient as any).setLanguage(config.stt.language);
      }
    }
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
    this.lastTranslationTime = Date.now();

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
          cb(session.id, { sentenceId, translation: fullTranslation, original: text });
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

import type {
  AppConfig,
  CorrectionResult,
  EnhancementStatusPayload,
  NoteSavedPayload,
  NoteSummaryPayload,
  Session,
  SessionState,
  STTResult,
  TranslatePartialPayload,
  TranslationConstraint,
  TranslationResult,
} from '../../../shared/types';
import { AudioFrameBuffer } from '../audio/AudioFrameBuffer';
import { EnhancementOrchestrator } from '../enhancement/EnhancementOrchestrator';
import { SentenceAssembler } from '../stt/SentenceAssembler';
import type { ISTTClient, STTClientState, STTResultMetadata } from '../stt/types';
import { createLogger } from '../../utils/logger';

interface IAudioCapture {
  start(source: 'system' | 'microphone', deviceId?: string): Promise<void>;
  stop(): void;
  onData(callback: (pcmBuffer: Int16Array) => void): () => void;
  get isRunning(): boolean;
}

interface INoteRepository {
  createSessionNote(session: Session, saveDir: string): Promise<string>;
  appendSentence(filePath: string, sentence: STTResult | (TranslationResult & { timestamp: number })): Promise<void>;
  appendSummary?(filePath: string, summary: string): Promise<void>;
}

interface ITranslationGateway {
  translateSentence(
    sentence: STTResult,
    options?: {
      constraints?: TranslationConstraint[];
      onPartial?: (payload: TranslatePartialPayload & { original: string; constraints: TranslationConstraint[] }) => void;
      signal?: AbortSignal;
    },
  ): Promise<TranslationResult>;
  reset(): void;
  updateWindowSize(size: number): void;
}

interface IConstraintResolver {
  resolve(text: string): Promise<TranslationConstraint[]> | TranslationConstraint[];
}

export interface ITranslator {
  generateSummary(sentences: TranslationResult[]): Promise<string>;
}

interface ICorrectionDetector {
  checkConsistency(translations: TranslationResult[]): Promise<CorrectionResult[]>;
  shouldCheck(sentenceCount: number): boolean;
}

interface IEnhancementOrchestrator {
  runSummary(params: {
    config?: Partial<AppConfig['enhancement']> | null;
    sessionId: string;
    translations: TranslationResult[];
    notePath?: string;
    translator?: ITranslator;
    noteRepository?: INoteRepository;
    emitStatus: (sessionId: string, payload: EnhancementStatusPayload) => void;
    onSummary?: (summary: string) => void;
  }): Promise<void>;
  runCorrection(params: {
    config?: Partial<AppConfig['enhancement']> | null;
    sessionId: string;
    translations: TranslationResult[];
    correctionDetector?: ICorrectionDetector;
    emitStatus: (sessionId: string, payload: EnhancementStatusPayload) => void;
  }): Promise<void>;
  runRecommendation(params: {
    config?: Partial<AppConfig['enhancement']> | null;
    sessionId: string;
    translations: TranslationResult[];
    emitStatus: (sessionId: string, payload: EnhancementStatusPayload) => void;
  }): Promise<void>;
}

export interface SessionDependencies {
  audioCapture: IAudioCapture;
  sttClient: ISTTClient;
  translationGateway?: ITranslationGateway;
  constraintResolver?: IConstraintResolver;
  translator?: ITranslator;
  noteWriter?: unknown;
  noteRepository?: INoteRepository;
  correctionDetector?: ICorrectionDetector;
  enhancementOrchestrator?: IEnhancementOrchestrator;
}

export type SessionEventCallback = (sessionId: string, data?: unknown) => void;

interface ActiveSession {
  session: Session;
  frameBuffer: AudioFrameBuffer;
  assembler: SentenceAssembler;
  unsubscribeAudio: (() => void) | null;
  unsubscribeAssembler: (() => void) | null;
  pendingNoteWrite: Promise<void>;
  translationQueue: STTResult[];
  translationLoopPromise: Promise<void> | null;
  translationAbortController: AbortController | null;
  partialTranslationAbortController: AbortController | null;
  lastPartialTranslationTextBySentenceId: Map<string, string>;
  partialTranslationVersionBySentenceId: Map<string, number>;
  translationPaused: boolean;
  enhancementEpoch: number;
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readSTTConfig(config: Partial<AppConfig> | null): {
  appId: string;
  apiKey: string;
  apiSecret: string;
  language: string;
} {
  return {
    appId: config?.stt?.appId ?? process.env.XFYUN_APP_ID ?? '',
    apiKey: config?.stt?.apiKey ?? process.env.XFYUN_API_KEY ?? '',
    apiSecret: config?.stt?.apiSecret ?? process.env.XFYUN_API_SECRET ?? '',
    language: config?.stt?.language ?? 'zh_cn',
  };
}

function mergeConfig(current: Partial<AppConfig> | null, next: Partial<AppConfig>): Partial<AppConfig> {
  return {
    ...(current ?? {}),
    ...next,
    general: { ...(current?.general ?? {}), ...(next.general ?? {}) } as AppConfig['general'],
    stt: { ...(current?.stt ?? {}), ...(next.stt ?? {}) } as AppConfig['stt'],
    translation: { ...(current?.translation ?? {}), ...(next.translation ?? {}) } as AppConfig['translation'],
    vector: { ...(current?.vector ?? {}), ...(next.vector ?? {}) } as AppConfig['vector'],
    note: { ...(current?.note ?? {}), ...(next.note ?? {}) } as AppConfig['note'],
    enhancement: { ...(current?.enhancement ?? {}), ...(next.enhancement ?? {}) } as AppConfig['enhancement'],
    audio: { ...(current?.audio ?? {}), ...(next.audio ?? {}) } as AppConfig['audio'],
  };
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === 'AbortError';
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('abort');
}

export class SessionManager {
  private l = createLogger('SessionManager');
  private activeSession: ActiveSession | null = null;
  private lastCompletedSession: Session | null = null;
  private config: Partial<AppConfig> | null = null;
  private currentState: SessionState = 'idle';
  private stateCallbacks = new Set<SessionEventCallback>();
  private transcriptCallbacks = new Set<SessionEventCallback>();
  private noteSavedCallbacks = new Set<SessionEventCallback>();
  private noteSummaryCallbacks = new Set<SessionEventCallback>();
  private enhancementStatusCallbacks = new Set<SessionEventCallback>();
  private translatePartialCallbacks = new Set<SessionEventCallback>();
  private translateFinalCallbacks = new Set<SessionEventCallback>();

  constructor(private deps: SessionDependencies) {
    this.deps.enhancementOrchestrator ??= new EnhancementOrchestrator();
    this.deps.sttClient.onResult((text, isFinal, sentenceId, metadata) => {
      this.handleSTTResult(text, isFinal, sentenceId, metadata);
    });
    this.deps.sttClient.onError?.((error) => {
      this.handleSTTError(error);
    });
    this.deps.sttClient.onClose?.(() => {
      this.handleSTTClose();
    });
    this.deps.sttClient.onStateChange?.((state) => {
      this.handleSTTStateChange(state);
    });
  }

  createSession(audioSource: 'system' | 'microphone'): Session {
    const session: Session = {
      id: generateSessionId(),
      startTime: Date.now(),
      audioSource,
      sentences: [],
    };

    this.l.info('会话已创建', { id: session.id, audioSource });
    return session;
  }

  async startSession(session: Session): Promise<void> {
    if (this.activeSession) {
      await this.endSession();
    }

    this.l.info('会话启动中', { id: session.id });

    this.deps.translationGateway?.reset();
    if (this.config?.translation?.contextWindowSize) {
      this.deps.translationGateway?.updateWindowSize(this.config.translation.contextWindowSize);
    }

    const frameBuffer = new AudioFrameBuffer();
    const assembler = new SentenceAssembler();
    const activeSession: ActiveSession = {
      session: { ...session, sentences: [...session.sentences] },
      frameBuffer,
      assembler,
      unsubscribeAudio: null,
      unsubscribeAssembler: null,
      pendingNoteWrite: Promise.resolve(),
      translationQueue: [],
      translationLoopPromise: null,
      translationAbortController: null,
      partialTranslationAbortController: null,
      lastPartialTranslationTextBySentenceId: new Map(),
      partialTranslationVersionBySentenceId: new Map(),
      translationPaused: false,
      enhancementEpoch: 0,
    };

    const noteSaveDir = this.config?.note?.saveDir?.trim();
    if (this.deps.noteRepository && noteSaveDir) {
      activeSession.session.notePath = await this.deps.noteRepository.createSessionNote(
        { ...activeSession.session },
        noteSaveDir,
      );
      this.emitNoteSaved(activeSession.session.id, activeSession.session.notePath);
    }

    const unsubscribeAssembler = assembler.onSentence((result) => {
      void this.handleSentenceResult(activeSession, result);
    });

    const unsubscribeAudio = this.deps.audioCapture.onData((pcmBuffer) => {
      frameBuffer.push(pcmBuffer);
    });
    frameBuffer.onFrame((frame) => {
      this.deps.sttClient.sendAudio(frame);
    });

    activeSession.unsubscribeAudio = unsubscribeAudio;
    activeSession.unsubscribeAssembler = unsubscribeAssembler;
    this.activeSession = activeSession;

    const sttConfig = readSTTConfig(this.config);
    this.deps.sttClient.connect(sttConfig);
    await this.deps.audioCapture.start(session.audioSource as 'system' | 'microphone');
    this.l.info('会话已启动', { id: session.id });
  }

  pauseSession(): void {
    if (!this.activeSession) {
      return;
    }

    this.l.info('会话已暂停', { id: this.activeSession.session.id });
    this.activeSession.translationPaused = true;
    this.activeSession.translationAbortController?.abort();
    this.cancelPartialTranslation(this.activeSession);
    this.deps.audioCapture.stop();
    this.deps.sttClient.disconnect();
    this.activeSession.frameBuffer.reset();
    this.setState('paused');
  }

  resumeSession(): void {
    if (!this.activeSession) {
      return;
    }

    this.l.info('会话已恢复', { id: this.activeSession.session.id });
    this.activeSession.translationPaused = false;
    const sttConfig = readSTTConfig(this.config);
    this.deps.sttClient.connect(sttConfig);
    void this.deps.audioCapture.start(this.activeSession.session.audioSource as 'system' | 'microphone');
    void this.processTranslationQueue(this.activeSession);
  }

  async endSession(): Promise<void> {
    if (!this.activeSession) {
      this.l.warn('endSession called without an active session');
      return;
    }

    const activeSession = this.activeSession;
    this.l.info('会话结束中', { id: activeSession.session.id });

    activeSession.translationPaused = false;

    try {
      this.deps.audioCapture.stop();
    } catch {
      // ignore audio shutdown issues during session stop
    }

    try {
      this.deps.sttClient.disconnect();
    } catch {
      // ignore websocket shutdown issues during session stop
    }

    activeSession.assembler.flush();
    await activeSession.pendingNoteWrite;
    await this.processTranslationQueue(activeSession);
    await activeSession.pendingNoteWrite;

    activeSession.frameBuffer.reset();
    activeSession.assembler.reset();
    activeSession.enhancementEpoch += 1;
    activeSession.translationAbortController?.abort();
    this.cancelPartialTranslation(activeSession);
    activeSession.unsubscribeAudio?.();
    activeSession.unsubscribeAssembler?.();
    activeSession.session.endTime = Date.now();
    this.lastCompletedSession = {
      ...activeSession.session,
      sentences: activeSession.session.sentences.map((sentence) => ({
        ...sentence,
        corrections: [...sentence.corrections],
        constraints: sentence.constraints ? [...sentence.constraints] : [],
      })),
    };

    this.activeSession = null;
    this.setState('stopped');
    this.l.info('会话已结束', {
      id: activeSession.session.id,
      sentenceCount: activeSession.session.sentences.length,
    });
  }

  getSessionState(): SessionState {
    if (!this.activeSession) {
      return this.currentState === 'stopped' ? 'stopped' : 'idle';
    }

    return this.currentState;
  }

  get currentSession(): Session | null {
    return this.activeSession?.session ?? null;
  }

  onSessionStateChange(callback: SessionEventCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => {
      this.stateCallbacks.delete(callback);
    };
  }

  onSessionTranscript(callback: SessionEventCallback): () => void {
    this.transcriptCallbacks.add(callback);
    return () => {
      this.transcriptCallbacks.delete(callback);
    };
  }

  onNoteSaved(callback: SessionEventCallback): () => void {
    this.noteSavedCallbacks.add(callback);
    return () => {
      this.noteSavedCallbacks.delete(callback);
    };
  }

  onSessionSTTPartial(callback: SessionEventCallback): () => void {
    return this.onSessionTranscript(callback);
  }

  onNoteSummary(callback: SessionEventCallback): () => void {
    this.noteSummaryCallbacks.add(callback);
    return () => {
      this.noteSummaryCallbacks.delete(callback);
    };
  }

  onEnhancementStatus(callback: SessionEventCallback): () => void {
    this.enhancementStatusCallbacks.add(callback);
    return () => {
      this.enhancementStatusCallbacks.delete(callback);
    };
  }

  onSessionTranslatePartial(callback: SessionEventCallback): () => void {
    this.translatePartialCallbacks.add(callback);
    return () => {
      this.translatePartialCallbacks.delete(callback);
    };
  }

  onSessionTranslateFinal(callback: SessionEventCallback): () => void {
    this.translateFinalCallbacks.add(callback);
    return () => {
      this.translateFinalCallbacks.delete(callback);
    };
  }

  updateConfig(config: Partial<AppConfig>): void {
    this.config = mergeConfig(this.config, config);
    if (config.stt?.language) {
      this.deps.sttClient.language = config.stt.language;
      this.deps.sttClient.setLanguage?.(config.stt.language);
    }
    if (config.translation?.contextWindowSize) {
      this.deps.translationGateway?.updateWindowSize(config.translation.contextWindowSize);
    }
  }

  async triggerSummary(): Promise<void> {
    const activeSession = this.activeSession;
    const targetSession = activeSession?.session ?? this.lastCompletedSession;
    const enhancement = this.config?.enhancement;
    if (!targetSession || !this.deps.enhancementOrchestrator) {
      return;
    }
    if (!enhancement?.enabled || !enhancement.summaryEnabled) {
      return;
    }
    if (targetSession.sentences.length === 0) {
      return;
    }

    const translations = targetSession.sentences.map((sentence) => ({
      ...sentence,
      corrections: [...sentence.corrections],
      constraints: sentence.constraints ? [...sentence.constraints] : [],
    }));

    await this.deps.enhancementOrchestrator.runSummary({
      config: enhancement,
      sessionId: targetSession.id,
      translations,
      notePath: targetSession.notePath,
      translator: this.deps.translator,
      noteRepository: this.deps.noteRepository,
      emitStatus: (targetSessionId, payload) => {
        this.emitEnhancementStatus(targetSessionId, payload);
      },
      onSummary: (summary) => {
        targetSession.summary = summary;
        if (this.activeSession?.session.id === targetSession.id) {
          this.activeSession.session.summary = summary;
        } else if (this.lastCompletedSession?.id === targetSession.id) {
          this.lastCompletedSession.summary = summary;
        }
        this.emitNoteSummary(targetSession.id, summary);
      },
    });
  }

  private handleSTTResult(
    text: string,
    isFinal: boolean,
    sentenceId: string,
    _metadata?: STTResultMetadata,
  ): void {
    if (!this.activeSession) {
      return;
    }

    this.activeSession.assembler.push({
      sentenceId,
      text,
      isFinal,
      timestamp: Date.now(),
    });
  }

  private async handleSentenceResult(activeSession: ActiveSession, result: STTResult): Promise<void> {
    for (const callback of this.transcriptCallbacks) {
      callback(activeSession.session.id, result);
    }

    if (result.isFinal && this.deps.translationGateway) {
      this.cancelPartialTranslation(activeSession);
      activeSession.translationQueue.push(result);
      await this.processTranslationQueue(activeSession);
    } else if (result.isFinal) {
      this.queueNoteWrite(activeSession, result);
    } else if (!result.isFinal && this.deps.translationGateway) {
      this.schedulePartialTranslation(activeSession, result);
    }
  }

  private queueNoteWrite(
    activeSession: ActiveSession,
    sentence: STTResult | (TranslationResult & { timestamp: number }),
  ): void {
    if (!this.deps.noteRepository || !activeSession.session.notePath) {
      return;
    }

    activeSession.pendingNoteWrite = activeSession.pendingNoteWrite.then(async () => {
      await this.deps.noteRepository?.appendSentence(activeSession.session.notePath!, sentence);
      this.emitNoteSaved(activeSession.session.id, activeSession.session.notePath!);
    });
  }

  private schedulePartialTranslation(activeSession: ActiveSession, result: STTResult): void {
    const text = result.text.trim();
    if (!text || activeSession.translationPaused || this.activeSession !== activeSession) {
      return;
    }

    if (activeSession.lastPartialTranslationTextBySentenceId.get(result.sentenceId) === text) {
      return;
    }

    activeSession.lastPartialTranslationTextBySentenceId.set(result.sentenceId, text);
    const nextVersion = (activeSession.partialTranslationVersionBySentenceId.get(result.sentenceId) ?? 0) + 1;
    activeSession.partialTranslationVersionBySentenceId.set(result.sentenceId, nextVersion);
    activeSession.partialTranslationAbortController?.abort();
    activeSession.partialTranslationAbortController = null;
    void this.runPartialTranslation(activeSession, { ...result, text }, nextVersion);
  }

  private cancelPartialTranslation(activeSession: ActiveSession): void {
    activeSession.partialTranslationAbortController?.abort();
    activeSession.partialTranslationAbortController = null;
  }

  private async runPartialTranslation(
    activeSession: ActiveSession,
    result: STTResult,
    version: number,
  ): Promise<void> {
    if (!this.deps.translationGateway || activeSession.translationPaused || this.activeSession !== activeSession) {
      return;
    }

    const controller = new AbortController();
    activeSession.partialTranslationAbortController = controller;
    const isLatestPartial = () =>
      activeSession.partialTranslationVersionBySentenceId.get(result.sentenceId) === version;

    try {
      const translation = await this.deps.translationGateway.translateSentence(result, {
        constraints: [],
        signal: controller.signal,
        onPartial: (payload) => {
          if (this.activeSession !== activeSession || activeSession.translationPaused || !isLatestPartial()) {
            return;
          }
          this.emitTranslatePartial(activeSession.session.id, {
            ...payload,
            constraints: [],
          });
        },
      });

      if (
        this.activeSession !== activeSession ||
        activeSession.translationPaused ||
        controller.signal.aborted ||
        !isLatestPartial()
      ) {
        return;
      }

      this.emitTranslatePartial(activeSession.session.id, {
        sentenceId: result.sentenceId,
        original: result.text,
        translation: translation.translation,
        constraints: [],
      });
    } catch (error) {
      if (!isAbortError(error)) {
        this.l.warn('Partial translation failed', {
          sentenceId: result.sentenceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } finally {
      if (activeSession.partialTranslationAbortController === controller) {
        activeSession.partialTranslationAbortController = null;
      }
    }
  }

  private async processTranslationQueue(activeSession: ActiveSession): Promise<void> {
    if (!this.deps.translationGateway) {
      return;
    }

    const existingLoop = activeSession.translationLoopPromise;
    if (existingLoop) {
      await existingLoop;
      if (activeSession.translationLoopPromise === existingLoop) {
        activeSession.translationLoopPromise = null;
      }
    }

    if (
      activeSession.translationLoopPromise ||
      activeSession.translationPaused ||
      activeSession.translationQueue.length === 0 ||
      this.activeSession !== activeSession
    ) {
      return;
    }

    activeSession.translationLoopPromise = (async () => {
      while (activeSession.translationQueue.length > 0) {
        if (activeSession.translationPaused) {
          break;
        }

        const sentence = activeSession.translationQueue[0];
        const controller = new AbortController();
        activeSession.translationAbortController = controller;

        try {
          const constraints = await this.resolveTranslationConstraints(sentence);
          const translation = await this.deps.translationGateway!.translateSentence(sentence, {
            constraints,
            signal: controller.signal,
            onPartial: (payload) => {
              if (this.activeSession !== activeSession || activeSession.translationPaused) {
                return;
              }
              this.emitTranslatePartial(activeSession.session.id, payload);
            },
          });

          activeSession.translationQueue.shift();
          activeSession.session.sentences.push(translation);
          this.queueNoteWrite(activeSession, {
            ...translation,
            timestamp: sentence.timestamp,
          });
          this.emitTranslateFinal(activeSession.session.id, translation);
          this.dispatchPostTranslationEnhancements(activeSession);
        } catch (error) {
          if (isAbortError(error)) {
            if (!activeSession.translationPaused) {
              activeSession.translationQueue.shift();
            }
            break;
          }

          throw error;
        } finally {
          activeSession.translationAbortController = null;
        }
      }
    })();

    try {
      await activeSession.translationLoopPromise;
    } finally {
      activeSession.translationLoopPromise = null;
    }
  }

  private async resolveTranslationConstraints(sentence: STTResult): Promise<TranslationConstraint[]> {
    if (!this.deps.constraintResolver) {
      return [];
    }

    try {
      const resolved = this.deps.constraintResolver.resolve(sentence.text);
      return Array.isArray(resolved) ? resolved : await resolved;
    } catch (error) {
      this.l.warn('术语约束解析失败，当前句按无约束翻译继续', {
        sentenceId: sentence.sentenceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private emitTranslatePartial(
    sessionId: string,
    payload: TranslatePartialPayload & { original: string; constraints: TranslationConstraint[] },
  ): void {
    for (const callback of this.translatePartialCallbacks) {
      callback(sessionId, payload);
    }
  }

  private emitTranslateFinal(sessionId: string, payload: TranslationResult): void {
    for (const callback of this.translateFinalCallbacks) {
      callback(sessionId, payload);
    }
  }

  private dispatchPostTranslationEnhancements(activeSession: ActiveSession): void {
    const enhancement = this.config?.enhancement;
    if (!enhancement?.enabled || !this.deps.enhancementOrchestrator) {
      return;
    }

    const snapshot = activeSession.session.sentences.map((translation) => ({
      ...translation,
      corrections: [...translation.corrections],
      constraints: translation.constraints ? [...translation.constraints] : [],
    }));
    const sessionId = activeSession.session.id;

    void this.deps.enhancementOrchestrator.runCorrection({
      config: enhancement,
      sessionId,
      translations: snapshot,
      correctionDetector: this.deps.correctionDetector,
      emitStatus: (targetSessionId, payload) => {
        if (this.activeSession?.session.id !== targetSessionId) {
          return;
        }
        this.emitEnhancementStatus(targetSessionId, payload);
      },
    });

    void this.deps.enhancementOrchestrator.runRecommendation({
      config: enhancement,
      sessionId,
      translations: snapshot,
      emitStatus: (targetSessionId, payload) => {
        if (this.activeSession?.session.id !== targetSessionId) {
          return;
        }
        this.emitEnhancementStatus(targetSessionId, payload);
      },
    });
  }

  private emitNoteSaved(sessionId: string, filePath: string): void {
    const payload: NoteSavedPayload = { filePath };
    for (const callback of this.noteSavedCallbacks) {
      callback(sessionId, payload);
    }
  }

  private emitNoteSummary(sessionId: string, summary: string): void {
    const payload: NoteSummaryPayload = { summary };
    for (const callback of this.noteSummaryCallbacks) {
      callback(sessionId, payload);
    }
  }

  private emitEnhancementStatus(sessionId: string, payload: EnhancementStatusPayload): void {
    for (const callback of this.enhancementStatusCallbacks) {
      callback(sessionId, payload);
    }
  }

  private handleSTTError(error: Error): void {
    if (!this.activeSession) {
      return;
    }

    this.l.error('STT 错误', { error: error.message });
    this.setState('error');
  }

  private handleSTTClose(): void {
    if (!this.activeSession) {
      return;
    }
  }

  private handleSTTStateChange(state: STTClientState): void {
    if (!this.activeSession) {
      return;
    }

    switch (state) {
      case 'connected':
        if (this.currentState !== 'paused') {
          this.setState('listening');
        }
        break;
      case 'recognizing':
        if (this.currentState !== 'paused') {
          this.setState('recognizing');
        }
        break;
      case 'reconnecting':
        if (this.currentState !== 'paused') {
          this.setState('reconnecting');
        }
        break;
      case 'failed':
        this.setState('error');
        break;
      case 'connecting':
      default:
        break;
    }
  }

  private setState(state: SessionState): void {
    this.currentState = state;
    const sessionId = this.activeSession?.session.id ?? '';
    for (const callback of this.stateCallbacks) {
      callback(sessionId, state);
    }
  }
}

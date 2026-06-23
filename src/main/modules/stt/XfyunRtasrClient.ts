import { createHash, createHmac } from 'crypto';
import WebSocket from 'ws';
import { STT_CONSTANTS } from '../../../shared/constants';
import { createLogger } from '../../utils/logger';
import type {
  ISTTClient,
  STTClientState,
  STTCloseCallback,
  STTConnectOptions,
  STTErrorCallback,
  STTResultCallback,
  STTStateCallback,
} from './types';

function generateSentenceId(): string {
  return `rtasr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildSigna(appId: string, ts: number, apiKey: string): string {
  const md5 = createHash('md5').update(`${appId}${ts}`).digest('hex');
  return createHmac('sha1', apiKey).update(md5).digest('base64');
}

function buildAuthUrl(config: STTConnectOptions): string {
  const ts = Math.floor(Date.now() / 1000);
  const signa = encodeURIComponent(buildSigna(config.appId, ts, config.apiKey));
  return `${STT_CONSTANTS.RTASR_WS_URL}?appid=${encodeURIComponent(config.appId)}&ts=${ts}&signa=${signa}`;
}

export class XfyunRtasrClient implements ISTTClient {
  private ws: WebSocket | null = null;
  private config: STTConnectOptions | null = null;
  private resultCallbacks = new Set<STTResultCallback>();
  private errorCallbacks = new Set<STTErrorCallback>();
  private closeCallbacks = new Set<STTCloseCallback>();
  private stateCallbacks = new Set<STTStateCallback>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectCount = 0;
  private connected = false;
  private manuallyClosed = false;
  private audioFrameCount = 0;
  private droppedFrameCount = 0;
  private messageCount = 0;
  private firstAudioFrameSentAt: number | null = null;
  private firstResultReceivedAt: number | null = null;
  private currentSentenceId = generateSentenceId();
  private fatalError = false;
  public language = 'zh_cn';
  private l = createLogger('XfyunRtasrClient');

  connect(config: STTConnectOptions): void {
    this.config = config;
    this.language = config.language || this.language;
    this.manuallyClosed = false;
    this.reconnectCount = 0;
    this.audioFrameCount = 0;
    this.droppedFrameCount = 0;
    this.messageCount = 0;
    this.firstAudioFrameSentAt = null;
    this.firstResultReceivedAt = null;
    this.currentSentenceId = generateSentenceId();
    this.fatalError = false;
    this.clearReconnectTimer();
    this.emitState('connecting');
    this.doConnect();
  }

  sendAudio(pcmChunk: Int16Array): void {
    if (!this.ws || !this.connected || this.ws.readyState !== WebSocket.OPEN) {
      this.droppedFrameCount += 1;
      return;
    }

    this.audioFrameCount += 1;
    if (this.firstAudioFrameSentAt === null) {
      this.firstAudioFrameSentAt = Date.now();
    }

    const payload = Buffer.from(
      pcmChunk.buffer,
      pcmChunk.byteOffset,
      pcmChunk.byteLength,
    );
    this.ws.send(payload);
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.connected = false;
    this.clearReconnectTimer();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send('{"end":true}');
      } catch {
        // ignore socket send failure while shutting down
      }
    }

    try {
      this.ws?.close();
    } catch {
      // ignore socket close failure while shutting down
    }

    this.ws = null;
    this.notifyClose();
  }

  onResult(callback: STTResultCallback): void {
    this.resultCallbacks.add(callback);
  }

  onError(callback: STTErrorCallback): void {
    this.errorCallbacks.add(callback);
  }

  onClose(callback: STTCloseCallback): void {
    this.closeCallbacks.add(callback);
  }

  onStateChange(callback: STTStateCallback): void {
    this.stateCallbacks.add(callback);
  }

  setLanguage(language: string): void {
    this.language = language || 'zh_cn';
  }

  get isConnected(): boolean {
    return this.connected;
  }

  private doConnect(): void {
    if (!this.config) {
      return;
    }

    const url = buildAuthUrl(this.config);
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectCount = 0;
      this.currentSentenceId = generateSentenceId();
      this.emitState('connected');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on('error', (error: Error) => {
      this.notifyError(error);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.connected = false;
      this.ws = null;
      this.l.info('STT WebSocket close metadata', {
        provider: 'xfyun-rtasr',
        code,
        reason: reason?.toString() ?? '',
        audioFrames: this.audioFrameCount,
        droppedFrames: this.droppedFrameCount,
        totalMessages: this.messageCount,
      });
      this.notifyClose();

      if (this.manuallyClosed || this.fatalError) {
        return;
      }

      this.attemptReconnect();
    });
  }

  private handleMessage(_data: WebSocket.Data): void {
    this.messageCount += 1;
    try {
      const message = this.parseMessage(_data);
      if (!message) {
        return;
      }

      if (message.action === 'error' || (message.code !== undefined && Number(message.code) !== 0)) {
        const error = new Error(
          `XFYun RTASR error: code=${String(message.code ?? 'unknown')}, message=${String(message.desc ?? message.message ?? 'unknown')}`,
        );
        if (this.isFatalErrorCode(message.code)) {
          this.fatalError = true;
          this.emitState('failed');
        }
        this.notifyError(error);
        return;
      }

      const text = this.extractText(message);
      const isFinal = this.isFinalMessage(message);

      if (!text && !isFinal) {
        return;
      }

      if (this.firstResultReceivedAt === null) {
        this.firstResultReceivedAt = Date.now();
        if (this.firstAudioFrameSentAt !== null) {
          this.l.info('STT first result latency', {
            provider: 'xfyun-rtasr',
            firstResultLatencyMs: this.firstResultReceivedAt - this.firstAudioFrameSentAt,
            targetMs: STT_CONSTANTS.FIRST_PARTIAL_TARGET_MS,
            audioFrames: this.audioFrameCount,
            totalMessages: this.messageCount,
          });
        }
      }

      const sentenceId = this.currentSentenceId;
      if (isFinal) {
        this.currentSentenceId = generateSentenceId();
      }

      for (const callback of this.resultCallbacks) {
        callback(text, isFinal, sentenceId, {
          provider: 'xfyun-rtasr',
          stable: isFinal,
          rawStatus: message.type ?? message.action ?? message.code,
        });
      }
    } catch {
      // Ignore malformed websocket messages.
    }
  }

  private parseMessage(data: WebSocket.Data): Record<string, any> | null {
    if (typeof data === 'string') {
      return JSON.parse(data) as Record<string, any>;
    }

    if (Buffer.isBuffer(data)) {
      return JSON.parse(data.toString('utf-8')) as Record<string, any>;
    }

    if (Array.isArray(data)) {
      return JSON.parse(Buffer.concat(data).toString('utf-8')) as Record<string, any>;
    }

    return JSON.parse(String(data)) as Record<string, any>;
  }

  private extractText(message: Record<string, any>): string {
    return this.extractStructuredText(message);
  }

  private extractStructuredText(message: Record<string, any>): string {
    const nested = this.extractNestedWords(message);
    if (nested) {
      return nested;
    }

    const text = this.normalizeTranscriptText(message.text);
    if (text) {
      return text;
    }

    const data = this.extractPayloadText(message.data);
    if (data) {
      return data;
    }

    const result = this.extractPayloadText(message.result);
    if (result) {
      return result;
    }

    return '';
  }

  private extractPayloadText(payload: unknown): string {
    if (typeof payload === 'string') {
      const parsed = this.parseJsonPayload(payload);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return this.extractStructuredText(parsed as Record<string, any>);
      }

      return parsed ? '' : this.normalizeTranscriptText(payload);
    }

    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return this.extractStructuredText(payload as Record<string, any>);
    }

    return '';
  }

  private getNestedStType(message: Record<string, any>): string | undefined {
    const nested = this.getNestedPayload(message);
    const type = nested?.cn?.st?.type;
    return type === undefined || type === null ? undefined : String(type);
  }

  private getNestedPayload(message: Record<string, any>): Record<string, any> | null {
    if (message.cn?.st) {
      return message;
    }

    for (const key of ['data', 'result']) {
      const payload = message[key];
      if (typeof payload === 'string') {
        const parsed = this.parseJsonPayload(payload);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, any>;
        }
      } else if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return payload as Record<string, any>;
      }
    }

    return null;
  }

  private parseJsonPayload(payload: string): unknown | null {
    const trimmed = payload.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return null;
    }

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }

  private extractNestedWords(message: Record<string, any>): string {
    const nestedWords = message.cn?.st?.rt;
    if (Array.isArray(nestedWords)) {
      const words: string[] = [];
      for (const rt of nestedWords) {
        for (const ws of rt?.ws ?? []) {
          for (const cw of ws?.cw ?? []) {
            if (cw?.w && cw?.wp !== 'p') {
              words.push(String(cw.w));
            }
          }
        }
      }
      return this.normalizeTranscriptText(words.join(''));
    }

    return '';
  }

  private normalizeTranscriptText(value: unknown): string {
    return typeof value === 'string'
      ? value.replace(/\s+/g, ' ').trim()
      : '';
  }

  private isFinalMessage(message: Record<string, any>): boolean {
    return (
      message.type === 'final' ||
      this.getNestedStType(message) === '0' ||
      message.isFinal === true ||
      message.action === 'end' ||
      String(message.action ?? '').toLowerCase() === 'final'
    );
  }

  private isFatalErrorCode(code: unknown): boolean {
    const normalized = String(code ?? '');
    return normalized === '10105' || normalized === '10110';
  }

  private attemptReconnect(): void {
    if (this.manuallyClosed) {
      return;
    }

    if (this.reconnectCount >= STT_CONSTANTS.MAX_RETRY_COUNT) {
      this.emitState('failed');
      this.notifyError(
        new Error(`STT reconnect failed after ${STT_CONSTANTS.MAX_RETRY_COUNT} retries`),
      );
      return;
    }

    this.reconnectCount += 1;
    this.emitState('reconnecting');
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, STT_CONSTANTS.RETRY_INTERVAL_MS);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private notifyError(error: Error): void {
    for (const callback of this.errorCallbacks) {
      callback(error);
    }
  }

  private notifyClose(): void {
    for (const callback of this.closeCallbacks) {
      callback();
    }
  }

  private emitState(state: STTClientState): void {
    for (const callback of this.stateCallbacks) {
      callback(state);
    }
  }
}

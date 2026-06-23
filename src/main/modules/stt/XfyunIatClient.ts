import { createHmac } from 'crypto';
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

function buildAuthUrl(apiKey: string, apiSecret: string): string {
  const host = 'iat-api.xfyun.cn';
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
  const signature = createHmac('sha256', apiSecret)
    .update(signatureOrigin)
    .digest('base64');

  const authorization = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const encodedAuthorization = Buffer.from(authorization).toString('base64');

  return `${STT_CONSTANTS.WS_URL}?authorization=${encodedAuthorization}&date=${encodeURIComponent(date)}&host=${host}`;
}

function generateSentenceId(): string {
  return `stt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class XfyunIatClient implements ISTTClient {
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
  private currentSentenceId = generateSentenceId();
  private audioFrameCount = 0;
  private droppedFrameCount = 0;
  private messageCount = 0;
  private firstAudioFrameSentAt: number | null = null;
  private firstResultReceivedAt: number | null = null;
  public language = 'zh_cn';
  private l = createLogger('XfyunIatClient');

  connect(config: STTConnectOptions): void {
    this.config = config;
    this.language = config.language || this.language;
    this.manuallyClosed = false;
    this.reconnectCount = 0;
    this.audioFrameCount = 0;
    this.messageCount = 0;
    this.droppedFrameCount = 0;
    this.firstAudioFrameSentAt = null;
    this.firstResultReceivedAt = null;
    this.currentSentenceId = generateSentenceId();
    this.clearReconnectTimer();
    this.emitState('connecting');
    this.l.info('STT 杩炴帴涓?', { url: STT_CONSTANTS.WS_URL, language: this.language });
    this.doConnect();
  }

  disconnect(): void {
    this.l.info('STT 杩炴帴鏂紑');
    this.manuallyClosed = true;
    this.connected = false;
    this.clearReconnectTimer();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            data: {
              status: 2,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: '',
            },
          }),
        );
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

  sendAudio(pcmChunk: Int16Array): void {
    if (!this.ws || !this.connected || this.ws.readyState !== WebSocket.OPEN) {
      this.droppedFrameCount += 1;
      if (this.droppedFrameCount === 1 || this.droppedFrameCount % 100 === 0) {
        this.l.warn('闊抽甯ц涓㈠純锛圫TT 鏈氨缁級', {
          dropped: this.droppedFrameCount,
          connected: this.connected,
        });
      }
      return;
    }

    this.audioFrameCount += 1;
    if (this.firstAudioFrameSentAt === null) {
      this.firstAudioFrameSentAt = Date.now();
    }
    if (this.audioFrameCount === 1 || this.audioFrameCount % 50 === 0) {
      this.l.info('闊抽甯у彂閫?', { count: this.audioFrameCount, frameSize: pcmChunk.length });
    }

    const base64Audio = Buffer.from(
      pcmChunk.buffer,
      pcmChunk.byteOffset,
      pcmChunk.byteLength,
    ).toString('base64');

    this.ws.send(
      JSON.stringify({
        data: {
          status: 1,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: base64Audio,
        },
      }),
    );
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

  reconnect(): void {
    if (!this.config) {
      return;
    }

    this.manuallyClosed = false;
    this.reconnectCount = 0;
    this.emitState('reconnecting');
    this.clearReconnectTimer();
    this.doConnect();
  }

  setLanguage(language: string): void {
    this.language = language || 'zh_cn';
  }

  getDroppedFrameCount(): number {
    return this.droppedFrameCount;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  private doConnect(): void {
    if (!this.config) {
      return;
    }

    const url = buildAuthUrl(this.config.apiKey, this.config.apiSecret);
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.connected = true;
      this.reconnectCount = 0;
      this.currentSentenceId = generateSentenceId();
      this.l.info('STT WebSocket 宸茶繛鎺?');
      this.emitState('connected');
      this.sendFirstFrame();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on('error', (error: Error) => {
      this.l.error('STT WebSocket 閿欒', { error: error.message });
      this.notifyError(error);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.connected = false;
      this.ws = null;
      this.l.info('STT WebSocket close metadata', {
        provider: 'xfyun-iat',
        code,
        reason: reason?.toString() ?? '',
        audioFrames: this.audioFrameCount,
        droppedFrames: this.droppedFrameCount,
        totalMessages: this.messageCount,
      });
      this.l.info('STT 杩炴帴鏂紑');
      this.notifyClose();

      if (this.manuallyClosed) {
        return;
      }

      this.attemptReconnect();
    });
  }

  private sendFirstFrame(): void {
    if (!this.ws || !this.config) {
      return;
    }

    const business: Record<string, unknown> = {
      language: this.language,
      domain: 'iat',
      accent: 'mandarin',
      eos: 1500,
    };

    if (this.language.toLowerCase().startsWith('zh')) {
      business.dwa = 'wpgs';
    }

    this.ws.send(
      JSON.stringify({
        common: { app_id: this.config.appId },
        business,
        data: {
          status: 0,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: '',
        },
      }),
    );
  }

  private handleMessage(data: WebSocket.Data): void {
    this.messageCount += 1;

    try {
      const message = JSON.parse(data.toString());
      if (message.code !== 0) {
        const error = new Error(`璁 STT 閿欒: code=${message.code}, message=${message.message}`);
        this.l.error('STT 杩斿洖閿欒', {
          code: message.code,
          message: message.message,
          totalMessages: this.messageCount,
        });
        this.notifyError(error);
        return;
      }

      const result = message.data?.result;
      if (!result) {
        return;
      }

      const text = this.extractText(result.ws);
      const isFinal = result.ls === true || message.data?.isEnd === 1;
      if (this.firstResultReceivedAt === null) {
        this.firstResultReceivedAt = Date.now();
        if (this.firstAudioFrameSentAt !== null) {
          this.l.info('STT first result latency', {
            provider: 'xfyun-iat',
            firstResultLatencyMs: this.firstResultReceivedAt - this.firstAudioFrameSentAt,
            targetMs: STT_CONSTANTS.FIRST_PARTIAL_TARGET_MS,
            audioFrames: this.audioFrameCount,
            totalMessages: this.messageCount,
          });
        }
      }
      if (text) {
        this.l.info('STT 缁撴灉', {
          text,
          isFinal,
          totalMessages: this.messageCount,
          audioFrames: this.audioFrameCount,
          accumulated: text.substring(0, 80),
        });
      }

      if (text || isFinal) {
        this.emitState('recognizing');
        const sentenceId = this.currentSentenceId;
        if (isFinal) {
          this.currentSentenceId = generateSentenceId();
        }

        for (const callback of this.resultCallbacks) {
          callback(text, isFinal, sentenceId);
        }
      }
    } catch {
      // Ignore malformed messages from websocket transport.
    }
  }

  private extractText(wsItems: Array<{ cw?: Array<{ w?: string }> }> | undefined): string {
    if (!wsItems) {
      return '';
    }

    const words: string[] = [];
    for (const wsItem of wsItems) {
      for (const candidate of wsItem.cw ?? []) {
        if (candidate.w) {
          words.push(candidate.w);
        }
      }
    }

    return words.join('');
  }

  private attemptReconnect(): void {
    if (this.manuallyClosed) {
      return;
    }

    if (this.reconnectCount >= STT_CONSTANTS.MAX_RETRY_COUNT) {
      this.emitState('failed');
      this.notifyError(
        new Error(`STT 閲嶈繛澶辫触锛氬凡瓒呰繃鏈€澶ч噸璇曟鏁?${STT_CONSTANTS.MAX_RETRY_COUNT}`),
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

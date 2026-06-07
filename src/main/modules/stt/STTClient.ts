/**
 * 讯飞 WebSocket 实时转写客户端
 * 负责与讯飞 STT 服务建立 WebSocket 连接，发送音频数据，接收转写结果
 */

import { createHmac } from 'crypto';
import WebSocket from 'ws';
import { STT_CONSTANTS } from '../../../shared/constants';
import { createLogger } from '../../utils/logger';

/** STT 客户端配置 */
interface STTConfig {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

/** 结果回调类型 */
type ResultCallback = (text: string, isFinal: boolean, sentenceId: string) => void;

/**
 * 创建讯飞 WebSocket 鉴权签名
 * @param apiKey - API Key
 * @param apiSecret - API Secret
 * @returns WebSocket URL（含鉴权参数）
 */
function buildAuthUrl(apiKey: string, apiSecret: string): string {
  const host = 'iat-api.xfyun.cn';
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;

  const hmac = createHmac('sha256', apiSecret);
  hmac.update(signatureOrigin);
  const signature = hmac.digest('base64');

  const authorization = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const encAuth = Buffer.from(authorization).toString('base64');
  const encDate = encodeURIComponent(date);

  return `${STT_CONSTANTS.WS_URL}?authorization=${encAuth}&date=${encDate}&host=${host}`;
}

/** 生成唯一句子 ID */
function generateSentenceId(): string {
  return `stt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 讯飞 WebSocket 实时转写客户端
 */
export class STTClient {
  private ws: WebSocket | null = null;
  private config: STTConfig | null = null;
  private resultCallbacks: Set<ResultCallback> = new Set();
  private errorCallbacks: Set<(error: Error) => void> = new Set();
  private closeCallbacks: Set<() => void> = new Set();
  private reconnectCount = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private closed = false;
  private currentSentenceId = '';
  /** 当前句累积文本（wpgs 模式下 isFinal 帧只含标点） */
  private accumulatedText = '';
  /** 上次收到部分结果的时间戳 */
  private lastPartialTime = 0;
  /** 定时 flush 句子的 interval */
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  /** 当前识别语言 */
  public language = 'zh_cn';
  /** 音频帧计数（用于诊断管线是否通畅） */
  private audioFrameCount = 0;
  /** 被丢弃的帧计数（连接未就绪时） */
  private droppedFrameCount = 0;
  /** STT 消息计数 */
  private messageCount = 0;
  private l = createLogger('STTClient');

  /**
   * 建立 WebSocket 连接
   * @param config - 讯飞 API 配置
   */
  connect(config: STTConfig): void {
    this.config = config;
    this.reconnectCount = 0;
    this.closed = false;
    this.currentSentenceId = generateSentenceId();
    this.accumulatedText = '';
    this.audioFrameCount = 0;
    this.messageCount = 0;
    this.droppedFrameCount = 0;
    this.l.info('STT 连接中', { url: STT_CONSTANTS.WS_URL, language: this.language });
    this.doConnect();
  }

  /** 执行 WebSocket 连接 */
  private doConnect(): void {
    if (!this.config) return;

    try {
      const url = buildAuthUrl(this.config.apiKey, this.config.apiSecret);
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.connected = true;
        this.reconnectCount = 0;
        this.accumulatedText = '';
        this.lastPartialTime = Date.now();
        this.currentSentenceId = generateSentenceId();
        this.l.info('STT WebSocket 已连接');
        this.startFlushTimer();
        this.sendFirstFrame();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (err: Error) => {
        this.l.error('STT WebSocket 错误', { error: err.message });
        this.notifyError(err);
      });

      this.ws.on('close', () => {
        this.l.info('STT WebSocket 已断开');
        this.connected = false;
        // 断连时如果还有未完成的累积文本，作为完整句子提交
        if (this.accumulatedText.trim()) {
          this.l.info('STT 断连时提交累积句', { text: this.accumulatedText.trim().substring(0, 60) });
          const finishId = this.currentSentenceId;
          this.currentSentenceId = generateSentenceId();
          for (const cb of this.resultCallbacks) {
            try { cb(this.accumulatedText.trim(), true, finishId); } catch { /* ignore */ }
          }
          this.accumulatedText = '';
        }
        this.notifyClose();
        this.attemptReconnect();
      });
    } catch (err) {
      this.notifyError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /** 更新识别语言 */
  setLanguage(lang: string): void {
    this.language = lang || 'zh_cn';
  }

  /** 发送首帧（携带鉴权和业务参数） */
  private sendFirstFrame(): void {
    if (!this.ws || !this.config) return;

    const frame = JSON.stringify({
      common: { app_id: this.config.appId },
      business: {
        language: this.language,
        domain: 'iat',
        accent: 'mandarin',
        vad_eos: 1500,
        dwa: 'wpgs',
      },
      data: {
        status: 0,
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: '',
      },
    });

    this.ws.send(frame);
  }

  /** 解析 WebSocket 消息 */
  private handleMessage(data: WebSocket.Data): void {
    try {
      this.messageCount++;
      const msg = JSON.parse(data.toString());
      if (msg.code !== 0) {
        this.notifyError(new Error(`讯飞 STT 错误: code=${msg.code}, message=${msg.message}`));
        this.l.error('STT 返回错误', { code: msg.code, message: msg.message, totalMessages: this.messageCount });
        return;
      }

      if (msg.data?.result) {
        const result = msg.data.result;

        // 提取文本
        const words: string[] = [];
        if (result.ws) {
          for (const wsItem of result.ws) {
            if (wsItem.cw) {
              for (const cwItem of wsItem.cw) {
                if (cwItem.w) words.push(cwItem.w);
              }
            }
          }
        }

        const text = words.join('');
        const isFinal = result.ls === true || msg.data.isEnd === 1;

        // 累积文本（wpgs 模式下每帧是增量，isFinal 帧可能只含标点）
        if (text) {
          this.accumulatedText += text;
          this.lastPartialTime = Date.now();
          this.l.info('STT 结果', { text, isFinal, totalMessages: this.messageCount, audioFrames: this.audioFrameCount, accumulated: this.accumulatedText.substring(0, 80) });
        }

        const finalizingId = this.currentSentenceId;
        const finalizingText = this.accumulatedText;

        if (isFinal) {
          this.currentSentenceId = generateSentenceId();
          this.accumulatedText = '';
        }

        for (const cb of this.resultCallbacks) {
          try {
            cb(isFinal ? finalizingText : text, isFinal, finalizingId);
          } catch { /* ignore */ }
        }
      }
    } catch {
      // 忽略解析错误
    }
  }

  /**
   * 发送 PCM 音频数据
   * @param pcmChunk - PCM 音频数据（Int16 格式，16kHz 单声道）
   */
  sendAudio(pcmChunk: Int16Array): void {
    if (!this.ws || !this.connected || this.ws.readyState !== WebSocket.OPEN) {
      this.droppedFrameCount++;
      if (this.droppedFrameCount === 1 || this.droppedFrameCount % 100 === 0) {
        this.l.warn('音频帧被丢弃（STT 未就绪）', { dropped: this.droppedFrameCount, connected: this.connected, readyState: this.ws?.readyState });
      }
      return;
    }

    this.audioFrameCount++;
    // 每50帧记录一次，确认管线通畅
    if (this.audioFrameCount === 1 || this.audioFrameCount % 50 === 0) {
      this.l.info('音频帧发送', { count: this.audioFrameCount, frameSize: pcmChunk.length });
    }

    const base64Audio = Buffer.from(pcmChunk.buffer).toString('base64');

    const frame = JSON.stringify({
      data: {
        status: 1,
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: base64Audio,
      },
    });

    try {
      this.ws.send(frame);
    } catch {
      // 忽略发送失败
    }
  }

  /** 发送结束帧并关闭 WebSocket 连接 */
  disconnect(): void {
    this.l.info('STT 连接断开');
    this.closed = true;

    this.stopFlushTimer();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws && this.connected) {
      try {
        const frame = JSON.stringify({
          data: {
            status: 2,
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: '',
          },
        });
        this.ws.send(frame);
      } catch {
        // 忽略
      }

      try {
        this.ws.close();
      } catch {
        // 忽略
      }
    }

    this.connected = false;
    this.ws = null;
  }

  /** 启动周期性 flush 定时器（每 2.5 秒检查是否有累积文本可提交） */
  private startFlushTimer(): void {
    this.stopFlushTimer();
    this.flushInterval = setInterval(() => {
      const text = this.accumulatedText.trim();
      if (!text || !this.connected) return;
      const elapsed = Date.now() - this.lastPartialTime;
      if (elapsed >= 2000) {
        this.l.info('定时flush句', { text: text.substring(0, 60), elapsed });
        const finishId = this.currentSentenceId;
        this.currentSentenceId = generateSentenceId();
        this.accumulatedText = '';
        for (const cb of this.resultCallbacks) {
          try { cb(text, true, finishId); } catch { /* ignore */ }
        }
      }
    }, 2500);
  }

  private stopFlushTimer(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * 注册转写结果回调
   * @param callback - 结果回调
   */
  onResult(callback: ResultCallback): void {
    this.resultCallbacks.add(callback);
  }

  /** 注册错误回调 */
  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.add(callback);
  }

  /** 注册连接关闭回调 */
  onClose(callback: () => void): void {
    this.closeCallbacks.add(callback);
  }

  /** 手动触发重连 */
  reconnect(): void {
    this.reconnectCount = 0;
    this.l.warn('STT 重连', { attempt: this.reconnectCount });
    this.doConnect();
  }

  /** 尝试自动重连 */
  private attemptReconnect(): void {
    if (this.closed) return;
    if (this.reconnectCount >= STT_CONSTANTS.MAX_RETRY_COUNT) {
      this.notifyError(new Error(`STT 重连失败：已超过最大重试次数 ${STT_CONSTANTS.MAX_RETRY_COUNT}`));
      return;
    }

    this.reconnectCount++;
    this.reconnectTimer = setTimeout(() => {
      this.doConnect();
    }, STT_CONSTANTS.RETRY_INTERVAL_MS);
  }

  /** 通知所有错误回调 */
  private notifyError(error: Error): void {
    for (const cb of this.errorCallbacks) {
      try {
        cb(error);
      } catch {
        // 忽略
      }
    }
  }

  /** 通知所有关闭回调 */
  private notifyClose(): void {
    for (const cb of this.closeCallbacks) {
      try {
        cb();
      } catch {
        // 忽略
      }
    }
  }

  /** 当前连接状态 */
  get isConnected(): boolean {
    return this.connected;
  }
}

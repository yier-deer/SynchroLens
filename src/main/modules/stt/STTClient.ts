/**
 * 讯飞 WebSocket 实时转写客户端
 * 负责与讯飞 STT 服务建立 WebSocket 连接，发送音频数据，接收转写结果
 */

import { createHmac } from 'crypto';
import WebSocket from 'ws';
import { STT_CONSTANTS } from '../../../shared/constants';

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
  private currentSentenceId = '';

  /**
   * 建立 WebSocket 连接
   * @param config - 讯飞 API 配置
   */
  connect(config: STTConfig): void {
    this.config = config;
    this.reconnectCount = 0;
    this.currentSentenceId = generateSentenceId();
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
        this.sendFirstFrame();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('error', (err: Error) => {
        this.notifyError(err);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.notifyClose();
        this.attemptReconnect();
      });
    } catch (err) {
      this.notifyError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /** 发送首帧（携带鉴权和业务参数） */
  private sendFirstFrame(): void {
    if (!this.ws || !this.config) return;

    const frame = JSON.stringify({
      common: { app_id: this.config.appId },
      business: {
        language: 'zh_cn',
        domain: 'iat',
        accent: 'mandarin',
        vad_eos: 2000,
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
      const msg = JSON.parse(data.toString());
      if (msg.code !== 0) {
        this.notifyError(new Error(`讯飞 STT 错误: code=${msg.code}, message=${msg.message}`));
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

        if (isFinal) {
          this.currentSentenceId = generateSentenceId();
        }

        for (const cb of this.resultCallbacks) {
          try {
            cb(text, isFinal, this.currentSentenceId);
          } catch {
            // 忽略回调异常
          }
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
    if (!this.ws || !this.connected || this.ws.readyState !== WebSocket.OPEN) return;

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
    this.doConnect();
  }

  /** 尝试自动重连 */
  private attemptReconnect(): void {
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

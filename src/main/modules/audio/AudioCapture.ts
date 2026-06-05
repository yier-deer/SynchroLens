/**
 * 音频采集模块
 * 负责从系统音频或麦克风采集 PCM 16bit 16kHz 音频数据
 */

import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';

/** 音频数据回调类型 */
type AudioDataCallback = (pcmBuffer: Int16Array) => void;

/** 音频采集事件名 */
const EVENTS = {
  DATA: 'data',
  ERROR: 'error',
  START: 'start',
  STOP: 'stop',
} as const;

/**
 * 音频采集模块
 * 封装系统音频/麦克风采集，输出 16kHz Int16 单声道 PCM 数据
 */
export class AudioCapture {
  private l = createLogger('AudioCapture');
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private dataCallbacks: Set<AudioDataCallback> = new Set();
  private running = false;
  private firstDataFlag = false;
  private currentSource: 'system' | 'microphone' = 'system';
  private emitter = new EventEmitter();

  /**
   * 启动音频采集
   * @param source - 音频来源类型
   * @param deviceId - 音频设备 ID（麦克风时有效）
   */
  async start(source: 'system' | 'microphone', deviceId?: string): Promise<void> {
    if (this.running) {
      this.stop();
    }

    this.currentSource = source;
    this.running = true;

    this.l.info('音频采集启动', { source, deviceId: deviceId || 'default' });

    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      const sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processorNode.onaudioprocess = (event) => {
        if (!this.running) return;
        if (!this.firstDataFlag) {
          this.firstDataFlag = true;
          this.l.debug('音频数据开始回调');
        }
        const inputData = event.inputBuffer.getChannelData(0);
        const int16Buffer = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const clamped = Math.max(-1, Math.min(1, inputData[i]));
          int16Buffer[i] = Math.round(clamped * 32767);
        }
        this.emitter.emit(EVENTS.DATA, int16Buffer);
        for (const cb of this.dataCallbacks) {
          try {
            cb(int16Buffer);
          } catch {
            // 忽略回调异常
          }
        }
      };

      sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.emitter.emit(EVENTS.START);
      this.l.info('音频采集已启动');
    } catch (err) {
      this.running = false;
      this.l.error('音频采集启动失败', { error: err instanceof Error ? err.message : String(err) });
      this.emitter.emit(EVENTS.ERROR, err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /** 停止音频采集并释放设备 */
  stop(): void {
    this.running = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.l.info('音频采集已停止');
    this.emitter.emit(EVENTS.STOP);
  }

  /**
   * 注册音频数据回调
   * @param callback - PCM 数据回调函数，参数为 Int16Array（16bit 16kHz 单声道）
   * @returns 取消注册函数
   */
  onData(callback: AudioDataCallback): () => void {
    this.dataCallbacks.add(callback);
    return () => {
      this.dataCallbacks.delete(callback);
    };
  }

  /** 注册错误回调 */
  onError(callback: (error: Error) => void): void {
    this.emitter.on(EVENTS.ERROR, callback);
  }

  /** 注册启动回调 */
  onStart(callback: () => void): void {
    this.emitter.on(EVENTS.START, callback);
  }

  /** 注册停止回调 */
  onStop(callback: () => void): void {
    this.emitter.on(EVENTS.STOP, callback);
  }

  /**
   * 获取可用的音频输入设备列表
   * @returns 设备信息数组
   */
  async getAvailableDevices(): Promise<{ deviceId: string; label: string }[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput' && d.deviceId)
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `设备 ${d.deviceId.slice(0, 8)}` }));
    } catch {
      return [];
    }
  }

  /** 当前是否正在采集 */
  get isRunning(): boolean {
    return this.running;
  }

  /** 当前音频来源 */
  get source(): 'system' | 'microphone' {
    return this.currentSource;
  }
}

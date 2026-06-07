import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';

type AudioDataCallback = (pcmBuffer: Int16Array) => void;

const EVENTS = {
  DATA: 'data',
  ERROR: 'error',
  START: 'start',
  STOP: 'stop',
} as const;

export class AudioCapture {
  private l = createLogger('AudioCapture');
  private recordProcess: ReturnType<typeof spawn> | null = null;
  private dataCallbacks: Set<AudioDataCallback> = new Set();
  private running = false;
  private currentSource: 'system' | 'microphone' = 'system';
  private emitter = new EventEmitter();

  async start(source: 'system' | 'microphone', deviceId?: string): Promise<void> {
    if (this.running) this.stop();
    this.currentSource = source;
    this.running = true;
    this.l.info('音频采集启动', { source, deviceId: deviceId || 'default' });

    try {
      // 优先使用 node-record-lpcm16（不依赖系统 sox PATH）
      try {
        const recordModule = require('node-record-lpcm16');
        const record = recordModule.record;
        if (typeof record === 'function') {
          const inst = record({ sampleRate: 16000, channels: 1, audioType: 'raw' });
          if (inst && inst.stream) {
            const audioStream = inst.stream() as NodeJS.ReadableStream;
            audioStream.on('data', (chunk: Buffer) => {
              if (!this.running) return;
              const samples = Math.floor(chunk.length / 2);
              if (samples <= 0) return;
              const int16Buffer = new Int16Array(chunk.buffer, chunk.byteOffset, samples);
              this.emitter.emit(EVENTS.DATA, int16Buffer);
              for (const cb of this.dataCallbacks) {
                try { cb(int16Buffer); } catch { /* ignore */ }
              }
            });
            audioStream.on('error', (err: Error) => {
              this.l.error('node-record-lpcm16 stream error', { error: err.message });
            });
            this.emitter.emit(EVENTS.START);
            this.l.info('音频采集已启动 (node-record-lpcm16)');
            return;
          }
        }
      } catch (e: any) {
        this.l.warn('node-record-lpcm16 不可用，回退 sox', { error: e?.message || String(e) });
      }

      // fallback sox
      const { cmd, args } = this.getRecorderCommand(source, deviceId);
      this.l.info('启动录音进程（sox fallback）', { cmd, args: args.join(' ') });
      this.recordProcess = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      this.recordProcess.stdout!.on('data', (chunk: Buffer) => {
        if (!this.running) return;
        const samples = Math.floor(chunk.length / 2);
        if (samples <= 0) return;
        const int16Buffer = new Int16Array(chunk.buffer, chunk.byteOffset, samples);
        this.emitter.emit(EVENTS.DATA, int16Buffer);
        for (const cb of this.dataCallbacks) {
          try { cb(int16Buffer); } catch { /* ignore */ }
        }
      });
      this.recordProcess.stderr!.on('data', (data: Buffer) => {
        this.l.debug('sox stderr', { message: data.toString().trim() });
      });
      this.recordProcess.on('error', (err: Error) => {
        this.l.error('sox 进程错误', { error: err.message });
        this.running = false;
        this.emitter.emit(EVENTS.ERROR, err);
      });
      this.recordProcess.on('close', (code: number | null) => {
        this.l.info('sox 进程退出', { code });
        if (this.running) { this.running = false; this.emitter.emit(EVENTS.STOP); }
      });
      this.emitter.emit(EVENTS.START);
      this.l.info('音频采集已启动 (sox fallback)');
    } catch (err) {
      this.running = false;
      this.l.error('音频采集启动失败', { error: (err as Error).message });
      this.emitter.emit(EVENTS.ERROR, err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  stop(): void {
    this.running = false;
    if (this.recordProcess) {
      try { this.recordProcess.kill('SIGTERM'); } catch { /* ignore */ }
      this.recordProcess = null;
    }
    this.l.info('音频采集已停止');
    this.emitter.emit(EVENTS.STOP);
  }

  onData(callback: AudioDataCallback): () => void {
    this.dataCallbacks.add(callback);
    return () => { this.dataCallbacks.delete(callback); };
  }

  onError(callback: (error: Error) => void): void {
    this.emitter.on(EVENTS.ERROR, callback);
  }

  onStart(callback: () => void): void {
    this.emitter.on(EVENTS.START, callback);
  }

  onStop(callback: () => void): void {
    this.emitter.on(EVENTS.STOP, callback);
  }

  async getAvailableDevices(): Promise<{ deviceId: string; label: string }[]> {
    return [];
  }

  get isRunning(): boolean {
    return this.running;
  }

  get source(): 'system' | 'microphone' {
    return this.currentSource;
  }

  private getRecorderCommand(source: 'system' | 'microphone', deviceId?: string): { cmd: string; args: string[] } {
    const rate = '16000';
    const platform = process.platform;
    if (platform === 'win32' || platform === 'darwin') {
      return { cmd: 'sox', args: ['-d', '-r', rate, '-c', '1', '-b', '16', '-e', 'signed-integer', '-t', 'raw', '-'] };
    }
    return { cmd: 'arecord', args: ['-D', deviceId || 'default', '-r', rate, '-c', '1', '-f', 'S16_LE', '-t', 'raw'] };
  }
}
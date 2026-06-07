import { spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';
import { createLogger } from '../../utils/logger';

type AudioDataCallback = (pcmBuffer: Int16Array) => void;

const EVENTS = {
  DATA: 'data',
  ERROR: 'error',
  START: 'start',
  STOP: 'stop',
} as const;

/** 检查 ffmpeg 是否可用 */
function isFfmpegAvailable(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** 获取 Windows dshow 音频设备列表 */
function getDshowDevices(): string[] {
  try {
    const output = execSync('ffmpeg -list_devices true -f dshow -i dummy', {
      stdio: 'pipe',
      timeout: 5000,
    }).toString();
    const devices: string[] = [];
    const match = output.match(/"([^"]+)"/g);
    if (match) {
      for (const m of match) {
        devices.push(m.replace(/"/g, ''));
      }
    }
    return devices;
  } catch {
    return [];
  }
}

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
    this.l.info('音频采集启动', { source, deviceId: deviceId || 'default', platform: process.platform });

    try {
      if (source === 'system' && process.platform === 'win32') {
        await this.startSystemAudioWindows();
        return;
      }

      if (source === 'system' && process.platform === 'darwin') {
        await this.startSystemAudioMacOS();
        return;
      }

      await this.startMicrophone(deviceId);
    } catch (err) {
      this.running = false;
      this.l.error('音频采集启动失败', { source, error: (err as Error).message });
      this.emitter.emit(EVENTS.ERROR, err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /** Windows 系统音频采集：使用 WASAPI 回环（通过 ffmpeg dshow / Stereo Mix） */
  private async startSystemAudioWindows(): Promise<void> {
    if (isFfmpegAvailable()) {
      this.l.info('ffmpeg 可用，尝试系统音频回环采集');
      try {
        const devices = getDshowDevices();
        this.l.info('dshow 设备列表', { devices });

        // 查找可能的回环设备名
        const loopbackCandidates = devices.filter(
          (d) =>
            d.toLowerCase().includes('stereo mix') ||
            d.toLowerCase().includes('混音') ||
            d.toLowerCase().includes('loopback') ||
            d.toLowerCase().includes('what u hear') ||
            d.toLowerCase().includes('wave out') ||
            d.toLowerCase().includes('cable'),
        );

        if (loopbackCandidates.length > 0) {
          const audioDevice = loopbackCandidates[0];
          this.l.info('找到回环设备', { device: audioDevice });

          const args = ['-f', 'dshow', '-i', `audio=${audioDevice}`, '-f', 's16le', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', 'pipe:1'];
          this.recordProcess = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

          // 等待300ms检查进程是否存活
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              if (this.recordProcess && this.recordProcess.exitCode === null) {
                resolve();
              } else {
                reject(new Error('ffmpeg 进程启动后立即退出'));
              }
            }, 300);
            this.recordProcess!.once('exit', (code) => {
              clearTimeout(timeout);
              reject(new Error(`ffmpeg 进程异常退出，code=${code}。请确认 Stereo Mix 已在 Windows 声音设置中启用`));
            });
            this.recordProcess!.once('error', (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });

          this.setupProcessListeners('ffmpeg dshow');
          this.emitter.emit(EVENTS.START);
          this.l.info('系统音频采集已启动 (ffmpeg dshow)');
          return;
        }

        this.l.warn('未找到系统音频回环设备，设备列表:', { devices });
        this.l.warn('请在 Windows 声音设置 → 录制设备 → 右键启用 Stereo Mix（立体声混音），或安装 VB-Cable');
      } catch (ffmpegErr) {
        this.l.warn('ffmpeg dshow 采集失败', { error: (ffmpegErr as Error).message });
      }
    } else {
      this.l.warn('ffmpeg 未安装，无法进行系统音频回环采集');
    }

    // 回退到麦克风
    this.l.warn('系统音频不可用，回退到麦克风采集（只能录到麦克风声音，不能录系统播放的音频）');
    await this.startMicrophone(undefined);
  }

  /** macOS 系统音频采集（通过 BlackHole / Soundflower） */
  private async startSystemAudioMacOS(): Promise<void> {
    if (isFfmpegAvailable()) {
      this.l.info('尝试 macOS 系统音频采集（avfoundation）');
      try {
        this.recordProcess = spawn('ffmpeg', [
          '-f', 'avfoundation',
          '-i', ':0',
          '-f', 's16le',
          '-acodec', 'pcm_s16le',
          '-ar', '16000',
          '-ac', '1',
          'pipe:1',
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        this.setupProcessListeners('ffmpeg avfoundation');
        this.emitter.emit(EVENTS.START);
        this.l.info('系统音频采集已启动 (ffmpeg avfoundation)');
        return;
      } catch {
        this.l.warn('ffmpeg avfoundation 失败，回退');
      }
    }
    this.l.warn('macOS 系统音频采集需要安装 BlackHole 或 Soundflower，当前回退到麦克风');
    await this.startMicrophone(undefined);
  }

  /** 麦克风采集（node-record-lpcm16 → sox fallback） */
  private async startMicrophone(deviceId?: string): Promise<void> {
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
          this.l.info('麦克风采集已启动 (node-record-lpcm16)');
          return;
        }
      }
    } catch (e: any) {
      this.l.warn('node-record-lpcm16 不可用，回退 sox', { error: e?.message || String(e) });
    }

    const { cmd, args } = this.getRecorderCommand('microphone', deviceId);
    this.l.info('启动录音进程（sox fallback）', { cmd, args: args.join(' ') });
    this.recordProcess = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.setupProcessListeners('sox');
    this.emitter.emit(EVENTS.START);
    this.l.info('麦克风采集已启动 (sox fallback)');
  }

  /** 设置音频采集进程的通用监听器 */
  private setupProcessListeners(label: string): void {
    if (!this.recordProcess) return;

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
      const msg = data.toString().trim();
      if (msg) {
        this.l.debug(`${label} stderr`, { message: msg.substring(0, 200) });
      }
    });

    this.recordProcess.on('error', (err: Error) => {
      this.l.error(`${label} 进程错误`, { error: err.message });
      this.running = false;
      this.emitter.emit(EVENTS.ERROR, err);
    });

    this.recordProcess.on('close', (code: number | null) => {
      this.l.info(`${label} 进程退出`, { code });
      if (this.running) {
        this.running = false;
        this.emitter.emit(EVENTS.STOP);
      }
    });
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.recordProcess) {
      try { this.recordProcess.kill('SIGTERM'); } catch { /* ignore */ }
      this.recordProcess = null;
    }
    this.l.info('音频采集已停止', { source: this.currentSource });
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
    if (isFfmpegAvailable()) {
      try {
        const devices = getDshowDevices();
        return devices.map((d, i) => ({ deviceId: `dshow-${i}`, label: d }));
      } catch {
        /* ignore */
      }
    }
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

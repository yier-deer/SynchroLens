import { spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { createLogger } from '../../utils/logger';

type AudioDataCallback = (pcmBuffer: Int16Array) => void;

const EVENTS = {
  DATA: 'data',
  ERROR: 'error',
  START: 'start',
  STOP: 'stop',
} as const;

/** 多路径查找 ffmpeg */
function findFfmpeg(): string | null {
  const candidates = [
    'E:\\ffmpeg\\ffmpeg-8.1.1-essentials_build\\bin\\ffmpeg.exe',
    'E:\\ffmpeg\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'ffmpeg',
  ];
  for (const c of candidates) {
    try {
      if (existsSync(c) || c === 'ffmpeg') {
        execSync(`"${c}" -version`, { stdio: 'ignore' });
        return c;
      }
    } catch { /* next */ }
  }
  return null;
}

/** 用 spawn 方式获取 dshow 设备列表（ffmpeg 输出在 stderr） */
async function getDshowDevices(ffmpegPath: string): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });
    proc.on('close', () => {
      const devices: string[] = [];
      const match = stderr.match(/"([^"]+)"/g);
      if (match) {
        for (const m of match) {
          const name = m.replace(/"/g, '');
          if (name && devices.indexOf(name) === -1) {
            devices.push(name);
          }
        }
      }
      resolve(devices);
    });
    proc.on('error', () => resolve([]));
    // 5 秒超时
    setTimeout(() => { try { proc.kill(); } catch { /* */ } resolve([]); }, 5000);
  });
}

/** 从设备列表找麦克风 */
function findMicrophone(devices: string[]): string | null {
  const keywords = ['麦克风', 'Microphone', 'mic', 'Mic', 'Realtek', 'Headset', '耳机'];
  for (const kw of keywords) {
    const found = devices.find(d => d.includes(kw));
    if (found) return found;
  }
  return null;
}

/** 从设备列表找回环设备 */
function findLoopback(devices: string[]): string | null {
  const keywords = ['stereo mix', '混音', 'loopback', 'what u hear', 'wave out', 'cable'];
  for (const kw of keywords) {
    const found = devices.find(d => d.toLowerCase().includes(kw));
    if (found) return found;
  }
  return null;
}

export class AudioCapture {
  private l = createLogger('AudioCapture');
  private recordProcess: ReturnType<typeof spawn> | null = null;
  private dataCallbacks: Set<AudioDataCallback> = new Set();
  private running = false;
  private currentSource: 'system' | 'microphone' = 'system';
  private emitter = new EventEmitter();
  /** 音频 chunk 计数器（诊断用） */
  private chunkCount = 0;

  async start(source: 'system' | 'microphone', deviceId?: string): Promise<void> {
    if (this.running) this.stop();
    this.currentSource = source;
    this.running = true;
    this.l.info('音频采集启动', { source, deviceId: deviceId || 'default', platform: process.platform });

    const ffmpegPath = findFfmpeg();
    if (!ffmpegPath) {
      this.running = false;
      throw new Error('ffmpeg 未找到。请安装 ffmpeg 到 E:\\ffmpeg 或系统 PATH');
    }
    this.l.info('找到 ffmpeg', { path: ffmpegPath });

    const devices = await getDshowDevices(ffmpegPath);
    this.l.info('dshow 设备列表', { devices, count: devices.length });

    try {
      if (source === 'system') {
        const loopback = findLoopback(devices);
        if (loopback) {
          this.l.info('找到回环设备', { device: loopback });
          await this.launchFfmpeg(ffmpegPath, loopback, 'ffmpeg dshow-loopback');
          return;
        }
        // 系统音频不可用 → 自动回退到麦克风
        this.l.warn('未找到系统音频回环设备（Stereo Mix/Cable），自动回退到麦克风');
      }

      // 麦克风采集
      const micDevice = deviceId || findMicrophone(devices);
      if (micDevice) {
        this.l.info('使用麦克风设备', { device: micDevice });
        await this.launchFfmpeg(ffmpegPath, micDevice, 'ffmpeg dshow-mic');
        return;
      }

      // 最后的回退：默认音频输入
      this.l.warn('未找到命名麦克风设备，尝试默认输入');
      await this.launchFfmpeg(ffmpegPath, null, 'ffmpeg dshow-default');
    } catch (err) {
      this.running = false;
      this.l.error('音频采集启动失败', { source, error: (err as Error).message });
      this.emitter.emit(EVENTS.ERROR, err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /** 用 ffmpeg dshow 启动指定设备 */
  private async launchFfmpeg(ffmpegPath: string, device: string | null, label: string): Promise<void> {
    const input = device ? `audio=${device}` : 'audio=default';
    const args = ['-f', 'dshow', '-rtbufsize', '2M', '-i', input, '-f', 's16le', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', 'pipe:1'];
    this.recordProcess = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    // 等 300ms 确认进程存活
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
        reject(new Error(`ffmpeg 进程异常退出(code=${code})。设备: ${device || 'default'}`));
      });
      this.recordProcess!.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    this.setupProcessListeners(label);
    this.emitter.emit(EVENTS.START);
    this.l.info('音频采集已启动', { label, device: device || 'default' });
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
      // 每 50 个 chunk 输出一条 info 日志确认管线活着
      this.chunkCount++;
      if (this.chunkCount % 50 === 0) {
        this.l.info('音频数据管线', { chunks: this.chunkCount, bytes: chunk.length });
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
    const ffmpegPath = findFfmpeg();
    if (ffmpegPath) {
      try {
        const devices = await getDshowDevices(ffmpegPath);
        return devices.map((d, i) => ({ deviceId: `dshow-${i}`, label: d }));
      } catch { /* ignore */ }
    }
    return [];
  }

  get isRunning(): boolean {
    return this.running;
  }

  get source(): 'system' | 'microphone' {
    return this.currentSource;
  }
}

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

/** 多路径查找 ffmpeg 可执行文件 */
function findFfmpeg(): string | null {
  const candidates = [
    'ffmpeg',
    'E:\\ffmpeg\\ffmpeg-8.1.1-essentials_build\\bin\\ffmpeg.exe',
    'E:\\ffmpeg\\ffmpeg-master-latest-win64-gpl\\bin\\ffmpeg.exe',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
  ];
  for (const c of candidates) {
    try {
      if (existsSync(c)) {
        execSync(`"${c}" -version`, { stdio: 'ignore' });
        return c;
      }
    } catch { /* 下一个 */ }
  }
  // 最后尝试纯命令名
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    return null;
  }
}

/** 获取 Windows dshow 音频设备列表（ffmpeg 输出在 stderr，非 stdout） */
function getDshowDevices(ffmpegPath: string): string[] {
  try {
    execSync(`"${ffmpegPath}" -list_devices true -f dshow -i dummy`, {
      stdio: 'pipe',
      timeout: 5000,
    });
  } catch (err: any) {
    // ffmpeg 设备列表总是非零退出；输出在 stderr
    const output = (err.stderr || err.stdout || '').toString();
    const devices: string[] = [];
    const match = output.match(/"([^"]+)"/g);
    if (match) {
      for (const m of match) {
        const name = m.replace(/"/g, '');
        if (devices.indexOf(name) === -1) devices.push(name);
      }
    }
    return devices;
  }
  return [];
}

/** 从设备列表中找麦克风设备 */
function findMicrophone(devices: string[]): string | null {
  const keywords = ['麦克风', 'Microphone', 'mic', 'Mic', 'Realtek', 'Headset', '耳机'];
  for (const kw of keywords) {
    const found = devices.find(d => d.includes(kw));
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

  /** Windows 系统音频：优先 ffmpeg dshow 回环设备 */
  private async startSystemAudioWindows(): Promise<void> {
    const ffmpegPath = findFfmpeg();
    if (!ffmpegPath) {
      this.l.warn('ffmpeg 未找到（已检查 E:\\ffmpeg 及系统 PATH），无法进行系统音频回环采集');
      this.l.warn('请将 ffmpeg 的 bin 目录加入系统环境变量 PATH，然后重启终端');
      throw new Error('ffmpeg 未安装或不在 PATH 中。系统音频采集需要 ffmpeg + Stereo Mix 设备');
    }
    this.l.info('找到 ffmpeg', { path: ffmpegPath });

    const devices = getDshowDevices(ffmpegPath);
    this.l.info('dshow 设备列表', { devices });

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
      this.recordProcess = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

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
          reject(new Error(`ffmpeg 进程异常退出(code=${code})。请确认 ${audioDevice} 已启用`));
        });
        this.recordProcess!.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      this.setupProcessListeners('ffmpeg dshow');
      this.emitter.emit(EVENTS.START);
      this.l.info('系统音频采集已启动 (ffmpeg dshow)', { device: audioDevice });
      return;
    }

    this.l.warn('未找到系统音频回环设备（Stereo Mix/Cable）', { devices });
    throw new Error(
      '未检测到 Stereo Mix 或 VB-Cable 等回环设备。请在 Windows 声音设置 → 录制设备 → 右键启用 Stereo Mix（立体声混音），或安装 VB-Cable 虚拟音频设备',
    );
  }

  /** macOS 系统音频（预留） */
  private async startSystemAudioMacOS(): Promise<void> {
    const ffmpegPath = findFfmpeg();
    if (!ffmpegPath) {
      throw new Error('macOS 系统音频采集需要安装 BlackHole 或 Soundflower，以及 ffmpeg');
    }
    this.recordProcess = spawn(ffmpegPath, [
      '-f', 'avfoundation', '-i', ':0', '-f', 's16le',
      '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    this.setupProcessListeners('ffmpeg avfoundation');
    this.emitter.emit(EVENTS.START);
    this.l.info('系统音频采集已启动 (ffmpeg avfoundation)');
  }

  /** 麦克风采集：用 ffmpeg dshow 直连（避免 node-record-lpcm16 内部 sox 崩溃） */
  private async startMicrophone(deviceId?: string): Promise<void> {
    const ffmpegPath = findFfmpeg();

    if (ffmpegPath && process.platform === 'win32') {
      const devices = getDshowDevices(ffmpegPath);
      this.l.info('dshow 设备列表', { devices });

      const micDevice = deviceId || findMicrophone(devices);

      if (micDevice) {
        this.l.info('使用麦克风设备', { device: micDevice });
        const args = ['-f', 'dshow', '-i', `audio=${micDevice}`, '-f', 's16le', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', 'pipe:1'];
        this.recordProcess = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        this.setupProcessListeners('ffmpeg dshow-mic');
        this.emitter.emit(EVENTS.START);
        this.l.info('麦克风采集已启动 (ffmpeg dshow)');
        return;
      }

      // 麦克风设备也找不到，用 ffmpeg 默认音频输入
      this.l.warn('未找到命名的麦克风设备，尝试默认输入');
      const args = ['-f', 'dshow', '-i', 'audio=default', '-f', 's16le', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', 'pipe:1'];
      this.recordProcess = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      this.setupProcessListeners('ffmpeg dshow-default');
      this.emitter.emit(EVENTS.START);
      this.l.info('麦克风采集已启动 (ffmpeg dshow default)');
      return;
    }

    // 无 ffmpeg：尝试 node-record-lpcm16（有崩溃风险，需全程 try-catch）
    this.l.warn('ffmpeg 不可用，尝试 node-record-lpcm16（需要 sox）');
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
            this.running = false;
            this.emitter.emit(EVENTS.ERROR, err);
          });
          this.emitter.emit(EVENTS.START);
          this.l.info('麦克风采集已启动 (node-record-lpcm16)');
          return;
        }
      }
    } catch (e: any) {
      this.l.warn('node-record-lpcm16 不可用', { error: e?.message || String(e) });
    }

    throw new Error(
      '麦克风采集失败。请安装 ffmpeg 到系统 PATH（推荐），或安装 sox。\n' +
      'ffmpeg 下载: https://ffmpeg.org\n' +
      'sox 下载: https://sourceforge.net/projects/sox/',
    );
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
    const ffmpegPath = findFfmpeg();
    if (ffmpegPath) {
      try {
        const devices = getDshowDevices(ffmpegPath);
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

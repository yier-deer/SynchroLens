import { EventEmitter } from 'events';
import type { spawn } from 'child_process';
import { AudioCapture } from '../../../src/main/modules/audio/AudioCapture';

type FakeProcess = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: jest.Mock<boolean, [NodeJS.Signals?]>;
  exitCode: number | null;
};

type FakeSpawnCall = [string, string[], { stdio: string[] }];

function createFakeProcess(): FakeProcess {
  const proc = new EventEmitter() as FakeProcess;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.exitCode = null;
  proc.kill = jest.fn(() => {
    proc.exitCode = 0;
    setImmediate(() => proc.emit('close', 0));
    return true;
  });
  return proc;
}

function createAudioCapture(
  overrides: Partial<ConstructorParameters<typeof AudioCapture>[0]> = {},
) {
  const fakeProcess = createFakeProcess();
  const spawnProcess = jest.fn<FakeProcess, FakeSpawnCall>(() => fakeProcess);
  const capture = new AudioCapture({
    findFfmpeg: () => 'C:\\ffmpeg\\bin\\ffmpeg.exe',
    getDshowDevices: async () => ['Stereo Mix (Realtek)', 'Microphone Array (Realtek)'],
    spawnProcess: spawnProcess as unknown as typeof spawn,
    startupDelayMs: 0,
    ...overrides,
  });

  return { capture, fakeProcess, spawnProcess };
}

describe('AudioCapture ffmpeg/dshow audio capture', () => {
  it('starts microphone capture through ffmpeg dshow', async () => {
    const { capture, spawnProcess } = createAudioCapture();

    await capture.start('microphone');

    expect(capture.isRunning).toBe(true);
    expect(capture.source).toBe('microphone');
    expect(spawnProcess).toHaveBeenCalledWith(
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      expect.arrayContaining([
        '-f',
        'dshow',
        '-i',
        'audio=Microphone Array (Realtek)',
        '-ar',
        '16000',
        '-ac',
        '1',
        'pipe:1',
      ]),
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    capture.stop();
  });

  it('prefers loopback device for system capture', async () => {
    const { capture, spawnProcess } = createAudioCapture();

    await capture.start('system');

    expect(capture.isRunning).toBe(true);
    expect(capture.source).toBe('system');
    expect(spawnProcess.mock.calls[0][1]).toContain('audio=Stereo Mix (Realtek)');

    capture.stop();
  });

  it('falls back to microphone when system loopback is unavailable', async () => {
    const { capture, spawnProcess } = createAudioCapture({
      getDshowDevices: async () => ['Microphone Array (Realtek)'],
    });

    await capture.start('system');

    expect(capture.isRunning).toBe(true);
    expect(spawnProcess.mock.calls[0][1]).toContain('audio=Microphone Array (Realtek)');

    capture.stop();
  });

  it('emits Int16 PCM chunks from ffmpeg stdout', async () => {
    const { capture, fakeProcess } = createAudioCapture();
    const dataCallback = jest.fn();
    capture.onData(dataCallback);

    await capture.start('microphone');
    fakeProcess.stdout.emit('data', Buffer.from([1, 0, 2, 0, 255, 255]));

    expect(dataCallback).toHaveBeenCalledTimes(1);
    expect(dataCallback.mock.calls[0][0]).toBeInstanceOf(Int16Array);
    expect(Array.from(dataCallback.mock.calls[0][0])).toEqual([1, 2, -1]);

    capture.stop();
  });

  it('unsubscribes data callbacks', async () => {
    const { capture, fakeProcess } = createAudioCapture();
    const dataCallback = jest.fn();
    const unsubscribe = capture.onData(dataCallback);

    await capture.start('microphone');
    unsubscribe();
    fakeProcess.stdout.emit('data', Buffer.from([1, 0]));

    expect(dataCallback).not.toHaveBeenCalled();

    capture.stop();
  });

  it('supports multiple data callbacks', async () => {
    const { capture, fakeProcess } = createAudioCapture();
    const firstCallback = jest.fn();
    const secondCallback = jest.fn();
    capture.onData(firstCallback);
    capture.onData(secondCallback);

    await capture.start('microphone');
    fakeProcess.stdout.emit('data', Buffer.from([3, 0]));

    expect(firstCallback).toHaveBeenCalledTimes(1);
    expect(secondCallback).toHaveBeenCalledTimes(1);

    capture.stop();
  });

  it('stops capture and kills the ffmpeg process', async () => {
    const { capture, fakeProcess } = createAudioCapture();
    const stopCallback = jest.fn();
    capture.onStop(stopCallback);

    await capture.start('microphone');
    capture.stop();

    expect(capture.isRunning).toBe(false);
    expect(fakeProcess.kill).toHaveBeenCalledWith('SIGTERM');
    expect(stopCallback).toHaveBeenCalledTimes(1);
  });

  it('switches source by stopping the current ffmpeg process first', async () => {
    const firstProcess = createFakeProcess();
    const secondProcess = createFakeProcess();
    const spawnProcess = jest.fn<FakeProcess, FakeSpawnCall>()
      .mockReturnValueOnce(firstProcess)
      .mockReturnValueOnce(secondProcess);
    const capture = new AudioCapture({
      findFfmpeg: () => 'C:\\ffmpeg\\bin\\ffmpeg.exe',
      getDshowDevices: async () => ['Stereo Mix (Realtek)', 'Microphone Array (Realtek)'],
      spawnProcess: spawnProcess as unknown as typeof spawn,
      startupDelayMs: 0,
    });

    await capture.start('system');
    await capture.start('microphone');

    expect(firstProcess.kill).toHaveBeenCalledWith('SIGTERM');
    expect(capture.source).toBe('microphone');
    expect(spawnProcess).toHaveBeenCalledTimes(2);

    capture.stop();
  });

  it('lists dshow audio devices without touching real hardware in tests', async () => {
    const { capture } = createAudioCapture({
      getDshowDevices: async () => ['Mic 1', 'Mic 2'],
    });

    await expect(capture.getAvailableDevices()).resolves.toEqual([
      { deviceId: 'dshow-0', label: 'Mic 1' },
      { deviceId: 'dshow-1', label: 'Mic 2' },
    ]);
  });

  it('returns an empty device list when ffmpeg is unavailable', async () => {
    const { capture } = createAudioCapture({
      findFfmpeg: () => null,
    });

    await expect(capture.getAvailableDevices()).resolves.toEqual([]);
  });

  it('fails start and resets running state when ffmpeg is unavailable', async () => {
    const { capture } = createAudioCapture({
      findFfmpeg: () => null,
    });

    await expect(capture.start('microphone')).rejects.toThrow(/ffmpeg/);
    expect(capture.isRunning).toBe(false);
  });

  it('emits error and resets running state when ffmpeg process errors', async () => {
    const fakeProcess = createFakeProcess();
    const spawnProcess = jest.fn<FakeProcess, FakeSpawnCall>(() => fakeProcess);
    const capture = new AudioCapture({
      findFfmpeg: () => 'C:\\ffmpeg\\bin\\ffmpeg.exe',
      getDshowDevices: async () => ['Microphone Array (Realtek)'],
      spawnProcess: spawnProcess as unknown as typeof spawn,
      startupDelayMs: 50,
    });
    const errorCallback = jest.fn();
    capture.onError(errorCallback);

    const startPromise = capture.start('microphone');
    const error = new Error('ffmpeg failed');
    setImmediate(() => fakeProcess.emit('error', error));

    await expect(startPromise).rejects.toThrow('ffmpeg failed');
    expect(errorCallback).toHaveBeenCalledWith(error);
    expect(capture.isRunning).toBe(false);
  });

  it('emits start event after ffmpeg startup is confirmed', async () => {
    const { capture } = createAudioCapture();
    const startCallback = jest.fn();
    capture.onStart(startCallback);

    await capture.start('microphone');

    expect(startCallback).toHaveBeenCalledTimes(1);

    capture.stop();
  });

  it('keeps default source before start', () => {
    const { capture } = createAudioCapture();

    expect(capture.isRunning).toBe(false);
    expect(capture.source).toBe('system');
  });
});

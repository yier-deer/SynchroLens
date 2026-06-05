/**
 * AudioCapture 音频采集模块单元测试
 * 测试系统音频和麦克风 PCM 数据采集功能
 */

import { AudioCapture } from '../../../src/main/modules/audio/AudioCapture';

/** 创建模拟的 MediaStream */
function createMockMediaStream(): any {
  return {
    getTracks: () => [{ stop: jest.fn() }],
  };
}

/** 创建模拟的 ScriptProcessorNode */
function createMockScriptProcessor(bufferSize: number): any {
  return {
    bufferSize,
    onaudioprocess: null as ((event: any) => void) | null,
    connect: jest.fn(),
    disconnect: jest.fn(),
  };
}

/** 创建模拟的 AudioProcessingEvent */
function createMockAudioEvent(samples: number): any {
  const channelData = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    channelData[i] = Math.sin((2 * Math.PI * 440 * i) / 16000);
  }
  return {
    inputBuffer: { getChannelData: () => channelData },
  };
}

describe('AudioCapture 音频采集模块', () => {
  let audioCapture: AudioCapture;
  let mockStream: any;
  let mockProcessor: any;
  let navigator: any;

  beforeEach(() => {
    mockStream = createMockMediaStream();
    mockProcessor = createMockScriptProcessor(4096);

    navigator = {
      mediaDevices: {
        getUserMedia: jest.fn().mockResolvedValue(mockStream),
        enumerateDevices: jest.fn().mockResolvedValue([
          { kind: 'audioinput', deviceId: 'dev-001', label: 'Mic 1' },
          { kind: 'audioinput', deviceId: 'dev-002', label: 'Mic 2' },
          { kind: 'videoinput', deviceId: 'video-001', label: 'Camera' },
        ]),
      },
    };

    // Mock navigator
    (global as any).navigator = navigator;

    // Mock AudioContext
    (global as any).AudioContext = jest.fn().mockImplementation(() => ({
      sampleRate: 16000,
      createMediaStreamSource: jest.fn().mockReturnValue({
        connect: jest.fn(),
      }),
      createScriptProcessor: jest.fn().mockReturnValue(mockProcessor),
      destination: {},
      close: jest.fn().mockResolvedValue(undefined),
    }));

    audioCapture = new AudioCapture();
  });

  afterEach(() => {
    audioCapture.stop();
  });

  describe('start 启动采集', () => {
    it('应该成功启动麦克风采集并开始输出 PCM 数据', async () => {
      const dataCallback = jest.fn();
      audioCapture.onData(dataCallback);

      await audioCapture.start('microphone');

      expect(audioCapture.isRunning).toBe(true);
      expect(audioCapture.source).toBe('microphone');
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('应该成功启动系统音频采集', async () => {
      await audioCapture.start('system');

      expect(audioCapture.isRunning).toBe(true);
      expect(audioCapture.source).toBe('system');
    });

    it('应该在采集到音频数据时触发 onData 回调', async () => {
      const dataCallback = jest.fn();
      audioCapture.onData(dataCallback);

      await audioCapture.start('microphone');

      // 模拟音频处理事件
      const audioEvent = createMockAudioEvent(4096);
      mockProcessor.onaudioprocess(audioEvent);

      expect(dataCallback).toHaveBeenCalledTimes(1);
      const pcmData = dataCallback.mock.calls[0][0] as Int16Array;
      expect(pcmData).toBeInstanceOf(Int16Array);
      expect(pcmData.length).toBe(4096);
    });

    it('应该在启动时触发 EventEmitter 事件', async () => {
      const startCallback = jest.fn();
      audioCapture.onStart(startCallback);

      await audioCapture.start('microphone');

      expect(startCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop 停止采集', () => {
    it('应该停止采集并释放设备', async () => {
      const stopCallback = jest.fn();
      audioCapture.onStop(stopCallback);

      await audioCapture.start('microphone');
      audioCapture.stop();

      expect(audioCapture.isRunning).toBe(false);
      expect(stopCallback).toHaveBeenCalledTimes(1);
    });

    it('应该停止 MediaStream 的所有轨道', async () => {
      const stopTrack = jest.fn();
      const streamWithTrackStop = {
        getTracks: () => [{ stop: stopTrack }],
      };

      navigator.mediaDevices.getUserMedia = jest.fn().mockResolvedValue(streamWithTrackStop);

      await audioCapture.start('microphone');
      audioCapture.stop();

      expect(stopTrack).toHaveBeenCalled();
    });

    it('应该在停止后不再触发 onData 回调', async () => {
      const dataCallback = jest.fn();
      audioCapture.onData(dataCallback);

      await audioCapture.start('microphone');
      audioCapture.stop();

      // 尝试触发事件，不应被调用
      const audioEvent = createMockAudioEvent(4096);
      mockProcessor.onaudioprocess(audioEvent);

      expect(dataCallback).not.toHaveBeenCalled();
    });
  });

  describe('onData 回调注册', () => {
    it('应该返回取消注册函数', async () => {
      const dataCallback = jest.fn();
      const unsubscribe = audioCapture.onData(dataCallback);

      await audioCapture.start('microphone');

      unsubscribe();

      const audioEvent = createMockAudioEvent(4096);
      mockProcessor.onaudioprocess(audioEvent);

      expect(dataCallback).not.toHaveBeenCalled();
    });

    it('应该支持多个回调同时注册', async () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      audioCapture.onData(cb1);
      audioCapture.onData(cb2);

      await audioCapture.start('microphone');
      const audioEvent = createMockAudioEvent(4096);
      mockProcessor.onaudioprocess(audioEvent);

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('切换音源', () => {
    it('应该在切换音源时先停止当前采集再启动新采集', async () => {
      await audioCapture.start('system');

      const stopSpy = jest.spyOn(audioCapture, 'stop');
      const getTracksSpy = jest.fn().mockReturnValue([{ stop: jest.fn() }]);

      navigator.mediaDevices.getUserMedia = jest.fn().mockResolvedValue({
        getTracks: getTracksSpy,
      });

      await audioCapture.start('microphone');

      // 切换音源时应停止旧采集
      expect(stopSpy).toHaveBeenCalled();
      expect(audioCapture.source).toBe('microphone');
    });
  });

  describe('getAvailableDevices 获取设备列表', () => {
    it('应该返回音频输入设备列表', async () => {
      const devices = await audioCapture.getAvailableDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0]).toEqual({ deviceId: 'dev-001', label: 'Mic 1' });
      expect(devices[1]).toEqual({ deviceId: 'dev-002', label: 'Mic 2' });
    });

    it('应该在 enumerateDevices 失败时返回空数组', async () => {
      navigator.mediaDevices.enumerateDevices = jest.fn().mockRejectedValue(new Error('Not allowed'));

      const devices = await audioCapture.getAvailableDevices();

      expect(devices).toEqual([]);
    });
  });

  describe('采集失败处理', () => {
    it('应该在获取媒体设备失败时触发 error 回调', async () => {
      const errorCallback = jest.fn();
      audioCapture.onError(errorCallback);

      navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(new Error('Permission denied'));

      try {
        await audioCapture.start('microphone');
      } catch {
        // 预期会抛出异常
      }

      expect(errorCallback).toHaveBeenCalled();
      expect(errorCallback.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(errorCallback.mock.calls[0][0].message).toContain('Permission denied');
      expect(audioCapture.isRunning).toBe(false);
    });
  });

  describe('isRunning 状态', () => {
    it('应该在初始状态为 false', () => {
      expect(audioCapture.isRunning).toBe(false);
    });

    it('应该在启动后为 true', async () => {
      await audioCapture.start('microphone');
      expect(audioCapture.isRunning).toBe(true);
    });

    it('应该在停止后恢复为 false', async () => {
      await audioCapture.start('microphone');
      audioCapture.stop();
      expect(audioCapture.isRunning).toBe(false);
    });
  });

  describe('source 属性', () => {
    it('应该在初始状态为 system', () => {
      expect(audioCapture.source).toBe('system');
    });

    it('应该在启动后更新为指定来源', async () => {
      await audioCapture.start('microphone');
      expect(audioCapture.source).toBe('microphone');
    });
  });
});

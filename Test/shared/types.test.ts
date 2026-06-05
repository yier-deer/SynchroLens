import {
  STTResult,
  TranslationResult,
  Correction,
  Session,
  SessionState,
  DeviceInfo,
  isSTTResult,
  isTranslationResult,
  isCorrection,
  isSession,
  isDeviceInfo,
  isSessionState,
  DEFAULT_CONFIG,
} from '../../src/shared/types';

describe('types 类型定义', () => {
  describe('isSTTResult 类型守卫', () => {
    it('应该对合法的 STTResult 返回 true', () => {
      const valid: STTResult = {
        sentenceId: 's-001',
        text: '你好世界',
        isFinal: true,
        timestamp: 1710000000000,
      };
      expect(isSTTResult(valid)).toBe(true);
    });

    it('应该对缺少 sentenceId 的对象返回 false', () => {
      const invalid = { text: 'test', isFinal: true, timestamp: 123 };
      expect(isSTTResult(invalid)).toBe(false);
    });

    it('应该对非对象类型返回 false', () => {
      expect(isSTTResult(null)).toBe(false);
      expect(isSTTResult(undefined)).toBe(false);
      expect(isSTTResult(42)).toBe(false);
      expect(isSTTResult('string')).toBe(false);
    });

    it('应该对 isFinal 为 false 的中间结果返回 true', () => {
      const partial: STTResult = {
        sentenceId: 's-002',
        text: '今天天',
        isFinal: false,
        timestamp: 1710000000100,
      };
      expect(isSTTResult(partial)).toBe(true);
    });
  });

  describe('isTranslationResult 类型守卫', () => {
    it('应该对合法的 TranslationResult 返回 true', () => {
      const valid: TranslationResult = {
        sentenceId: 's-001',
        original: 'Hello world',
        translation: '你好世界',
        isFinal: true,
        corrections: [],
      };
      expect(isTranslationResult(valid)).toBe(true);
    });

    it('应该对缺少 corrections 的对象返回 false', () => {
      const invalid = {
        sentenceId: 's-001',
        original: 'Hello',
        translation: '你好',
        isFinal: true,
      };
      expect(isTranslationResult(invalid)).toBe(false);
    });

    it('应该对 null 返回 false', () => {
      expect(isTranslationResult(null)).toBe(false);
    });

    it('应该对含纠正记录的 TranslationResult 返回 true', () => {
      const withCorrection: TranslationResult = {
        sentenceId: 's-003',
        original: 'bank',
        translation: '河岸',
        isFinal: false,
        corrections: [
          { from: '河岸', to: '银行', reason: '金融语境', timestamp: 1710000000200 },
        ],
      };
      expect(isTranslationResult(withCorrection)).toBe(true);
    });
  });

  describe('isCorrection 类型守卫', () => {
    it('应该对合法的 Correction 返回 true', () => {
      const valid: Correction = {
        from: '旧译文',
        to: '新译文',
        reason: '术语一致',
        timestamp: 1710000000000,
      };
      expect(isCorrection(valid)).toBe(true);
    });

    it('应该对缺少 reason 的对象返回 false', () => {
      const invalid = { from: 'A', to: 'B', timestamp: 123 };
      expect(isCorrection(invalid)).toBe(false);
    });

    it('应该对空对象返回 false', () => {
      expect(isCorrection({})).toBe(false);
    });
  });

  describe('isSession 类型守卫', () => {
    it('应该对合法的 Session 返回 true', () => {
      const valid: Session = {
        id: 'session-001',
        startTime: 1710000000000,
        audioSource: 'system',
        sentences: [],
      };
      expect(isSession(valid)).toBe(true);
    });

    it('应该对无效的 audioSource 返回 false', () => {
      const invalid = {
        id: 's-1',
        startTime: 123,
        audioSource: 'invalid_source',
        sentences: [],
      };
      expect(isSession(invalid)).toBe(false);
    });

    it('应该对缺少 sentences 的对象返回 false', () => {
      const invalid = {
        id: 's-1',
        startTime: 123,
        audioSource: 'microphone',
      };
      expect(isSession(invalid)).toBe(false);
    });

    it('应该对含 endTime 和 summary 的 Session 返回 true', () => {
      const valid: Session = {
        id: 'session-002',
        startTime: 1710000000000,
        endTime: 1710000060000,
        audioSource: 'file',
        sentences: [],
        notePath: '/notes/14-30.md',
        summary: '摘要内容',
      };
      expect(isSession(valid)).toBe(true);
    });
  });

  describe('isDeviceInfo 类型守卫', () => {
    it('应该对合法的 DeviceInfo 返回 true', () => {
      const valid: DeviceInfo = { deviceId: 'dev-1', label: '默认麦克风' };
      expect(isDeviceInfo(valid)).toBe(true);
    });

    it('应该对缺少 label 的对象返回 false', () => {
      const invalid = { deviceId: 'dev-1' };
      expect(isDeviceInfo(invalid)).toBe(false);
    });

    it('应该对 null 返回 false', () => {
      expect(isDeviceInfo(null)).toBe(false);
    });
  });

  describe('isSessionState 类型守卫', () => {
    it('应该对 "idle" 返回 true', () => {
      expect(isSessionState('idle')).toBe(true);
    });

    it('应该对 "running" 返回 true', () => {
      expect(isSessionState('running')).toBe(true);
    });

    it('应该对 "paused" 返回 true', () => {
      expect(isSessionState('paused')).toBe(true);
    });

    it('应该对 "stopped" 返回 true', () => {
      expect(isSessionState('stopped')).toBe(true);
    });

    it('应该对非法状态值返回 false', () => {
      expect(isSessionState('invalid')).toBe(false);
      expect(isSessionState('')).toBe(false);
      expect(isSessionState('IDLE')).toBe(false);
    });

    it('应该对非字符串类型返回 false', () => {
      expect(isSessionState(42)).toBe(false);
      expect(isSessionState(null)).toBe(false);
      expect(isSessionState(undefined)).toBe(false);
    });
  });

  describe('SessionState 值约束', () => {
    it('应该只包含四种合法状态', () => {
      const validStates: SessionState[] = ['idle', 'running', 'paused', 'stopped'];
      expect(validStates).toHaveLength(4);
      const unique = new Set(validStates);
      expect(unique.size).toBe(4);
    });
  });

  describe('DEFAULT_CONFIG 默认值常量', () => {
    it('应该导出 DEFAULT_CONFIG 对象', () => {
      expect(DEFAULT_CONFIG).toBeDefined();
      expect(typeof DEFAULT_CONFIG).toBe('object');
    });

    it('应该包含 general 默认配置', () => {
      expect(DEFAULT_CONFIG.general.language).toBe('zh-CN');
      expect(DEFAULT_CONFIG.general.theme).toBe('system');
      expect(DEFAULT_CONFIG.general.minimizeToTray).toBe(true);
      expect(DEFAULT_CONFIG.general.autoStart).toBe(false);
    });

    it('应该包含 stt 默认配置', () => {
      expect(DEFAULT_CONFIG.stt.provider).toBe('xfyun');
      expect(DEFAULT_CONFIG.stt.language).toBe('zh_cn');
    });

    it('应该包含 translation 默认配置', () => {
      expect(DEFAULT_CONFIG.translation.provider).toBe('deepseek');
      expect(DEFAULT_CONFIG.translation.targetLanguage).toBe('zh-CN');
      expect(DEFAULT_CONFIG.translation.contextCorrection).toBe(true);
      expect(DEFAULT_CONFIG.translation.contextWindowSize).toBe(5);
    });

    it('应该包含 note 默认配置', () => {
      expect(DEFAULT_CONFIG.note.saveDir).toBe('');
      expect(DEFAULT_CONFIG.note.autoSave).toBe(true);
      expect(DEFAULT_CONFIG.note.autoSaveInterval).toBe(5000);
      expect(DEFAULT_CONFIG.note.autoSummary).toBe(true);
      expect(DEFAULT_CONFIG.note.summaryThreshold).toBe(20);
    });

    it('应该包含 audio 默认配置', () => {
      expect(DEFAULT_CONFIG.audio.source).toBe('system');
      expect(DEFAULT_CONFIG.audio.systemAudioBackend).toBe('wasapi');
      expect(DEFAULT_CONFIG.audio.sampleRate).toBe(16000);
      expect(DEFAULT_CONFIG.audio.noiseReduction).toBe(false);
    });
  });
});

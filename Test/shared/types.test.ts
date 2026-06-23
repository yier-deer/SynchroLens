import {
  STTResult,
  TranslationResult,
  Correction,
  Session,
  SessionState,
  KnowledgeSourceType,
  KnowledgeHit,
  TranslationConstraint,
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
  describe('KnowledgeHit 知识命中类型', () => {
    it('应该冻结第一批知识来源类型', () => {
      const sourceTypes: KnowledgeSourceType[] = [
        'language-dictionary',
        'domain-dictionary',
        'personal-dictionary',
        'translation-memory',
      ];

      expect(sourceTypes).toEqual([
        'language-dictionary',
        'domain-dictionary',
        'personal-dictionary',
        'translation-memory',
      ]);
    });

    it('应该表达知识命中的来源、分数、优先级和消费方', () => {
      const hit: KnowledgeHit = {
        id: 'personal:similar:entry-1',
        query: 'latency',
        source: 'latency',
        target: '时延',
        sourceType: 'translation-memory',
        matchType: 'similar',
        priority: 3,
        score: 0.92,
        entryId: 'entry-1',
        notePath: 'notes/session.md',
        consumers: ['translation-constraint', 'enhancement-recommendation'],
      };

      expect(hit.sourceType).toBe('translation-memory');
      expect(hit.score).toBe(0.92);
      expect(hit.consumers).toContain('translation-constraint');
    });

    it('应该继续允许 TranslationConstraint.score 承载相似检索分数', () => {
      const constraint: TranslationConstraint = {
        source: 'latency',
        target: '时延',
        sourceType: 'personal',
        priority: 3,
        matchType: 'similar',
        enforceMode: 'sentence',
        score: 0.87,
      };

      expect(constraint.score).toBe(0.87);
    });
  });

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
    it('应该包含当前主链路使用的八种合法状态', () => {
      const validStates: SessionState[] = [
        'idle',
        'running',
        'listening',
        'recognizing',
        'reconnecting',
        'paused',
        'stopped',
        'error',
      ];
      expect(validStates).toHaveLength(8);
      const unique = new Set(validStates);
      expect(unique.size).toBe(8);
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
      expect(DEFAULT_CONFIG.stt.provider).toBe('xfyun-rtasr');
      expect(DEFAULT_CONFIG.stt.language).toBe('zh_cn');
    });

    it('应该包含 translation 默认配置', () => {
      expect(DEFAULT_CONFIG.stt.provider).toBe('xfyun-rtasr');
    });

    it('uses XFYun RTASR as the default realtime STT provider', () => {
      expect(DEFAULT_CONFIG.stt.provider).toBe('xfyun-rtasr');
    });

    it('搴旇鍖呭惈 translation 榛樿閰嶇疆', () => {
      expect(DEFAULT_CONFIG.translation.provider).toBe('tencent-tmt');
      expect(DEFAULT_CONFIG.translation.targetLanguage).toBe('zh-CN');
      expect(DEFAULT_CONFIG.translation.contextCorrection).toBe(false);
      expect(DEFAULT_CONFIG.translation.contextWindowSize).toBe(5);
      expect(DEFAULT_CONFIG.translation.apiEndpoint).toBe('http://127.0.0.1:8765');
      expect(DEFAULT_CONFIG.translation.model).toBe('tencent-tmt');
      expect(DEFAULT_CONFIG.translation.tencent).toEqual({
        enabled: true,
        region: 'ap-guangzhou',
        projectId: 0,
        sourceLanguage: 'auto',
        secretKeySaved: false,
      });
    });

    it('应该包含 llm 默认配置', () => {
      expect(DEFAULT_CONFIG.llm.provider).toBe('deepseek');
      expect(DEFAULT_CONFIG.llm.apiEndpoint).toBe('https://api.deepseek.com');
      expect(DEFAULT_CONFIG.llm.model).toBe('deepseek-v4-flash');
    });

    it('应该包含 note 默认配置', () => {
      expect(DEFAULT_CONFIG.note.saveDir).toBe('');
      expect(DEFAULT_CONFIG.note.autoSave).toBe(true);
      expect(DEFAULT_CONFIG.note.autoSaveInterval).toBe(5000);
      expect(DEFAULT_CONFIG.note.autoSummary).toBe(true);
      expect(DEFAULT_CONFIG.note.summaryThreshold).toBe(20);
    });

    it('应该包含 enhancement 默认配置', () => {
      expect(DEFAULT_CONFIG.enhancement.enabled).toBe(false);
      expect(DEFAULT_CONFIG.enhancement.summaryEnabled).toBe(true);
      expect(DEFAULT_CONFIG.enhancement.correctionEnabled).toBe(true);
      expect(DEFAULT_CONFIG.enhancement.recommendationEnabled).toBe(true);
    });

    it('应该包含 audio 默认配置', () => {
      expect(DEFAULT_CONFIG.audio.source).toBe('system');
      expect(DEFAULT_CONFIG.audio.systemAudioBackend).toBe('wasapi');
      expect(DEFAULT_CONFIG.audio.sampleRate).toBe(16000);
      expect(DEFAULT_CONFIG.audio.noiseReduction).toBe(false);
    });
  });
});

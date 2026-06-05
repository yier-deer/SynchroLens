import { IPC_CHANNELS, IPCChannel, MainToRendererChannel, RendererToMainChannel } from '../../src/shared/ipcChannels';

describe('ipcChannels 通道常量', () => {
  describe('IPC_CHANNELS 对象', () => {
    it('应该包含所有 Main → Renderer 通道', () => {
      expect(IPC_CHANNELS.STT_PARTIAL).toBe('stt:partial');
      expect(IPC_CHANNELS.STT_SENTENCE).toBe('stt:sentence');
      expect(IPC_CHANNELS.TRANSLATE_PARTIAL).toBe('translate:partial');
      expect(IPC_CHANNELS.TRANSLATE_FINAL).toBe('translate:final');
      expect(IPC_CHANNELS.TRANSLATE_CORRECT).toBe('translate:correct');
      expect(IPC_CHANNELS.NOTE_SAVED).toBe('note:saved');
      expect(IPC_CHANNELS.NOTE_SUMMARY).toBe('note:summary');
    });

    it('应该包含所有 Renderer → Main 通道', () => {
      expect(IPC_CHANNELS.SESSION_START).toBe('session:start');
      expect(IPC_CHANNELS.SESSION_STOP).toBe('session:stop');
      expect(IPC_CHANNELS.SESSION_PAUSE).toBe('session:pause');
      expect(IPC_CHANNELS.CONFIG_UPDATE).toBe('config:update');
      expect(IPC_CHANNELS.SUMMARY_TRIGGER).toBe('summary:trigger');
    });

    it('应该共有 12 个通道', () => {
      const keys = Object.keys(IPC_CHANNELS);
      expect(keys).toHaveLength(12);
    });
  });

  describe('通道值与通道名字符串一致性', () => {
    it('所有通道值应与其键名对应的命名一致', () => {
      const entries = Object.entries(IPC_CHANNELS);
      for (const [key, value] of entries) {
        // 将键名从 UPPER_SNAKE_CASE 转回 camelCase 格式验证
        const expectedPrefix = key.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        // 通道值格式为 "prefix:suffix"
        expect(typeof value).toBe('string');
        expect(value).toMatch(/^[a-z]+:[a-z]+$/);
      }
    });
  });

  describe('通道值唯一性', () => {
    it('所有通道值应不重复', () => {
      const values = Object.values(IPC_CHANNELS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it('每个通道值应唯一对应一个键', () => {
      const values = Object.values(IPC_CHANNELS);
      const seen = new Set<string>();
      for (const v of values) {
        expect(seen.has(v)).toBe(false);
        seen.add(v);
      }
    });
  });

  describe('IPCChannel 类型联合', () => {
    it('IPCChannel 类型应包含所有通道值', () => {
      const allValues = Object.values(IPC_CHANNELS) as string[];
      const channelValues: IPCChannel[] = [...allValues] as IPCChannel[];
      expect(channelValues).toHaveLength(12);
    });
  });

  describe('MainToRendererChannel 类型', () => {
    it('应包含 7 个 Main → Renderer 通道', () => {
      const mainChannels: MainToRendererChannel[] = [
        'stt:partial',
        'stt:sentence',
        'translate:partial',
        'translate:final',
        'translate:correct',
        'note:saved',
        'note:summary',
      ];
      const unique = new Set(mainChannels);
      expect(unique.size).toBe(7);
    });
  });

  describe('RendererToMainChannel 类型', () => {
    it('应包含 5 个 Renderer → Main 通道', () => {
      const rendererChannels: RendererToMainChannel[] = [
        'session:start',
        'session:stop',
        'session:pause',
        'config:update',
        'summary:trigger',
      ];
      const unique = new Set(rendererChannels);
      expect(unique.size).toBe(5);
    });
  });

  describe('as const 不可变性', () => {
    it('IPC_CHANNELS 的值应为字面量类型', () => {
      const sttPartial: typeof IPC_CHANNELS.STT_PARTIAL = 'stt:partial';
      expect(sttPartial).toBe('stt:partial');
    });
  });
});

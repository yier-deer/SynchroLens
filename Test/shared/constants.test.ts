import {
  AUDIO_CONSTANTS,
  STT_CONSTANTS,
  TRANSLATE_CONSTANTS,
  NOTE_CONSTANTS,
  UI_CONSTANTS,
  SHORTCUT_CONSTANTS,
} from '../../src/shared/constants';

describe('constants 业务常量', () => {
  describe('AUDIO_CONSTANTS 音频常量', () => {
    it('应包含正确的采样率', () => {
      expect(AUDIO_CONSTANTS.SAMPLE_RATE).toBe(16000);
      expect(AUDIO_CONSTANTS.INPUT_SAMPLE_RATE).toBe(48000);
    });

    it('帧大小应正确计算（SAMPLE_RATE * FRAME_INTERVAL_MS / 1000 * 2bytes）', () => {
      // FRAME_SIZE = 16000 * 40ms / 1000ms * 2bytes(16bit) = 1280
      const expectedFrameSize = AUDIO_CONSTANTS.SAMPLE_RATE * AUDIO_CONSTANTS.FRAME_INTERVAL_MS / 1000 * 2;
      expect(AUDIO_CONSTANTS.FRAME_SIZE).toBe(expectedFrameSize);
      expect(AUDIO_CONSTANTS.FRAME_SIZE).toBe(1280);
    });

    it('帧间隔应为 40ms', () => {
      expect(AUDIO_CONSTANTS.FRAME_INTERVAL_MS).toBe(40);
    });

    it('应不可修改（as const 冻结）', () => {
      expect(() => {
        (AUDIO_CONSTANTS as Record<string, number>).SAMPLE_RATE = 99999;
      }).toThrow();
    });
  });

  describe('STT_CONSTANTS 语音识别常量', () => {
    it('应包含正确的重连配置', () => {
      expect(STT_CONSTANTS.MAX_RETRY_COUNT).toBe(3);
      expect(STT_CONSTANTS.RETRY_INTERVAL_MS).toBe(2000);
    });

    it('应包含正确的超时配置', () => {
      expect(STT_CONSTANTS.CONNECTION_TIMEOUT_MS).toBe(10000);
      expect(STT_CONSTANTS.MAX_SESSION_DURATION_MS).toBe(60000);
    });

    it('应包含讯飞 WebSocket URL', () => {
      expect(STT_CONSTANTS.WS_URL).toBe('wss://iat-api.xfyun.cn/v2/iat');
    });

    it('应不可修改（as const 冻结）', () => {
      expect(() => {
        (STT_CONSTANTS as Record<string, unknown>).WS_URL = 'https://hacked.example.com';
      }).toThrow();
    });
  });

  describe('TRANSLATE_CONSTANTS 翻译常量', () => {
    it('应包含正确的上下文窗口大小', () => {
      expect(TRANSLATE_CONSTANTS.CONTEXT_WINDOW_SIZE).toBe(5);
    });

    it('应包含正确的超时和重试配置', () => {
      expect(TRANSLATE_CONSTANTS.TRANSLATION_TIMEOUT_MS).toBe(10000);
      expect(TRANSLATE_CONSTANTS.MAX_RETRY_COUNT).toBe(3);
    });

    it('应包含正确的 API 配置', () => {
      expect(TRANSLATE_CONSTANTS.API_BASE_URL).toBe('https://api.deepseek.com');
      expect(TRANSLATE_CONSTANTS.MODEL).toBe('deepseek-v4-flash');
      expect(TRANSLATE_CONSTANTS.TEMPERATURE).toBe(0.3);
    });

    it('退避策略的间隔序列应正确（1s → 2s → 4s → 8s）', () => {
      const { INITIAL_RETRY_INTERVAL_MS, RETRY_BACKOFF_FACTOR, MAX_RETRY_INTERVAL_MS, MAX_RETRY_COUNT } =
        TRANSLATE_CONSTANTS;

      const intervals: number[] = [];
      let current: number = INITIAL_RETRY_INTERVAL_MS;
      for (let i = 0; i < MAX_RETRY_COUNT; i++) {
        intervals.push(current);
        current = Math.min(current * RETRY_BACKOFF_FACTOR, MAX_RETRY_INTERVAL_MS);
      }

      expect(intervals).toEqual([1000, 2000, 4000]);
      // 第 4 次间隔应为 8000（上限）
      expect(Math.min(4000 * 2, MAX_RETRY_INTERVAL_MS)).toBe(8000);
    });

    it('初始重试间隔应为 1000ms', () => {
      expect(TRANSLATE_CONSTANTS.INITIAL_RETRY_INTERVAL_MS).toBe(1000);
    });

    it('退避因子应为 2', () => {
      expect(TRANSLATE_CONSTANTS.RETRY_BACKOFF_FACTOR).toBe(2);
    });

    it('最大重试间隔应为 8000ms', () => {
      expect(TRANSLATE_CONSTANTS.MAX_RETRY_INTERVAL_MS).toBe(8000);
    });
  });

  describe('NOTE_CONSTANTS 笔记常量', () => {
    it('应包含正确的默认保存目录', () => {
      expect(NOTE_CONSTANTS.DEFAULT_SAVE_DIR).toBe('SynchroLens/Notes');
    });

    it('应包含正确的自动保存配置', () => {
      expect(NOTE_CONSTANTS.AUTO_SAVE_INTERVAL_MS).toBe(5000);
    });

    it('应包含正确的纠正批处理配置', () => {
      expect(NOTE_CONSTANTS.CORRECTION_BATCH_SIZE).toBe(5);
    });

    it('应包含正确的写入重试配置', () => {
      expect(NOTE_CONSTANTS.WRITE_RETRY_COUNT).toBe(3);
      expect(NOTE_CONSTANTS.WRITE_RETRY_INTERVAL_MS).toBe(1000);
    });
  });

  describe('UI_CONSTANTS UI 常量', () => {
    it('应包含正确的字幕相关配置', () => {
      expect(UI_CONSTANTS.MAX_VISIBLE_SENTENCES).toBe(8);
      expect(UI_CONSTANTS.SUBTITLE_BG_OPACITY).toBe(0.7);
    });

    it('应包含正确的动画时长配置', () => {
      expect(UI_CONSTANTS.PANEL_MERGE_DURATION_MS).toBe(300);
      expect(UI_CONSTANTS.CORRECTION_ANIMATION_MS).toBe(300);
    });
  });

  describe('SHORTCUT_CONSTANTS 快捷键常量', () => {
    it('应包含开始/停止快捷键', () => {
      expect(SHORTCUT_CONSTANTS.START_STOP).toBe('Ctrl+Shift+S');
    });

    it('应包含暂停/恢复快捷键', () => {
      expect(SHORTCUT_CONSTANTS.PAUSE_RESUME).toBe('Ctrl+Shift+P');
    });
  });

  describe('as const 冻结验证', () => {
    it('所有常量组应不可修改', () => {
      const groups = [
        AUDIO_CONSTANTS,
        STT_CONSTANTS,
        TRANSLATE_CONSTANTS,
        NOTE_CONSTANTS,
        UI_CONSTANTS,
        SHORTCUT_CONSTANTS,
      ];

      for (const group of groups) {
        const keys = Object.keys(group);
        expect(keys.length).toBeGreaterThan(0);
        // 尝试修改应抛出错误
        for (const key of keys) {
          expect(() => {
            (group as Record<string, unknown>)[key] = null;
          }).toThrow();
        }
      }
    });
  });
});

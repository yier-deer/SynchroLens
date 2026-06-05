import { detectVoiceActivity, computeEnergy } from '../../../src/main/utils/vad';

describe('vad 语音活动检测', () => {
  describe('detectVoiceActivity', () => {
    it('应该在有语音信号（能量超过阈值）时返回 true', () => {
      const pcm = new Int16Array(1600);
      for (let i = 0; i < pcm.length; i++) {
        pcm[i] = Math.floor(Math.sin(2 * Math.PI * 440 * i / 16000) * 16384);
      }
      expect(detectVoiceActivity(pcm, 100)).toBe(true);
    });

    it('应该在静音段（能量低于阈值）时返回 false', () => {
      const pcm = new Int16Array(1600);
      for (let i = 0; i < pcm.length; i++) {
        pcm[i] = 50;
      }
      expect(detectVoiceActivity(pcm, 100)).toBe(false);
    });

    it('应该正确处理全零缓冲区', () => {
      const pcm = new Int16Array(1600);
      expect(detectVoiceActivity(pcm)).toBe(false);
      expect(detectVoiceActivity(pcm, 0)).toBe(false);
    });

    it('应该在阈值边界值处给出正确判断', () => {
      const threshold = 500;
      const pcmLow = new Int16Array(1600);
      for (let i = 0; i < pcmLow.length; i++) {
        pcmLow[i] = 400;
      }
      // RMS of all 400 ≈ 400 < 500
      expect(detectVoiceActivity(pcmLow, threshold)).toBe(false);

      const pcmHigh = new Int16Array(1600);
      for (let i = 0; i < pcmHigh.length; i++) {
        pcmHigh[i] = 800;
      }
      // RMS of all 800 ≈ 800 > 500
      expect(detectVoiceActivity(pcmHigh, threshold)).toBe(true);
    });
  });

  describe('computeEnergy', () => {
    it('应该正确计算 PCM 缓冲区的 RMS 能量值', () => {
      const pcm = new Int16Array([1000, 1000, 1000, 1000]);
      const energy = computeEnergy(pcm);
      expect(energy).toBeCloseTo(1000, 0);
    });

    it('应该对空缓冲区返回 0', () => {
      expect(computeEnergy(new Int16Array(0))).toBe(0);
    });

    it('应该对全零缓冲区返回 0', () => {
      expect(computeEnergy(new Int16Array(100))).toBe(0);
    });
  });
});

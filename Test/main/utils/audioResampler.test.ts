import { resample } from '../../../src/main/utils/audioResampler';

describe('audioResampler 音频重采样', () => {
  describe('resample', () => {
    it('应该将 48kHz Float32 PCM 正确重采样为 16kHz Int16 PCM', () => {
      const inputSampleRate = 48000;
      const outputSampleRate = 16000;
      const durationMs = 100;
      const samples = Math.floor(inputSampleRate * durationMs / 1000);
      const input = new Float32Array(samples);

      for (let i = 0; i < samples; i++) {
        input[i] = Math.sin(2 * Math.PI * 440 * i / inputSampleRate);
      }

      const output = resample(input, inputSampleRate, outputSampleRate);
      const expectedLength = Math.floor(samples * outputSampleRate / inputSampleRate);

      expect(output).toBeInstanceOf(Int16Array);
      expect(output.length).toBe(expectedLength);
    });

    it('应该处理空输入并返回空 Int16Array', () => {
      const result = resample(new Float32Array(0), 48000, 16000);
      expect(result).toBeInstanceOf(Int16Array);
      expect(result.length).toBe(0);
    });

    it('应该在输入采样率等于输出采样率时直接转换格式而不改变采样率', () => {
      const sampleRate = 16000;
      const input = new Float32Array(1600);
      for (let i = 0; i < input.length; i++) {
        input[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
      }

      const output = resample(input, sampleRate, sampleRate);
      expect(output.length).toBe(input.length);
      expect(output).toBeInstanceOf(Int16Array);
    });

    it('应该正确处理包含静音段（全零）的输入', () => {
      const input = new Float32Array(4800);
      const output = resample(input, 48000, 16000);

      for (let i = 0; i < output.length; i++) {
        expect(output[i]).toBe(0);
      }
    });

    it('应该在重采样后保持音频信号幅度在 Int16 范围内', () => {
      const inputSampleRate = 48000;
      const samples = 4800;
      const input = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        input[i] = Math.sin(2 * Math.PI * 440 * i / inputSampleRate);
      }

      const output = resample(input, inputSampleRate, 16000);

      for (let i = 0; i < output.length; i++) {
        expect(output[i]).toBeGreaterThanOrEqual(-32768);
        expect(output[i]).toBeLessThanOrEqual(32767);
      }
    });
  });
});

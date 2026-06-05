/**
 * 音频重采样工具模块
 * 将输入 PCM 数据从输入采样率转换为输出采样率
 */

/**
 * 音频重采样：将输入 PCM 数据从输入采样率转换为输出采样率
 * @param inputBuffer - 输入 PCM 数据（Float32 格式）
 * @param inputSampleRate - 输入采样率
 * @param outputSampleRate - 输出采样率
 * @returns 重采样后的 PCM 数据（Int16 格式）
 */
export function resample(inputBuffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Int16Array {
  if (inputBuffer.length === 0) {
    return new Int16Array(0);
  }

  if (inputSampleRate === outputSampleRate) {
    return float32ToInt16(inputBuffer);
  }

  const ratio = outputSampleRate / inputSampleRate;
  const outputLength = Math.floor(inputBuffer.length * ratio);
  const outputBuffer = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i / ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const frac = srcIndex - srcIndexFloor;

    if (srcIndexFloor + 1 < inputBuffer.length) {
      const sample = inputBuffer[srcIndexFloor] * (1 - frac) + inputBuffer[srcIndexFloor + 1] * frac;
      outputBuffer[i] = floatToInt16(sample);
    } else {
      outputBuffer[i] = floatToInt16(inputBuffer[srcIndexFloor]);
    }
  }

  return outputBuffer;
}

/**
 * 将 Float32 PCM 数组转换为 Int16 PCM 数组
 * @param buffer - Float32 格式的 PCM 数据（范围 -1.0 ~ 1.0）
 * @returns Int16 格式的 PCM 数据（范围 -32768 ~ 32767）
 */
function float32ToInt16(buffer: Float32Array): Int16Array {
  const result = new Int16Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    result[i] = floatToInt16(buffer[i]);
  }
  return result;
}

/**
 * 将单个 Float32 采样值转换为 Int16
 * @param value - Float32 采样值（范围 -1.0 ~ 1.0）
 * @returns Int16 采样值（范围 -32768 ~ 32767）
 */
function floatToInt16(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value));
  return Math.round(clamped * 32767);
}

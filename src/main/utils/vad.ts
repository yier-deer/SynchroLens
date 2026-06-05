/**
 * 语音活动检测（VAD）工具模块
 * 基于 RMS 能量阈值判断 PCM 缓冲区是否包含语音活动
 */

/**
 * 语音活动检测：判断 PCM 缓冲区是否包含语音
 * @param pcmBuffer - PCM 音频数据（Int16 格式）
 * @param threshold - 能量阈值，默认 500
 * @returns 是否检测到语音活动
 */
export function detectVoiceActivity(pcmBuffer: Int16Array, threshold: number = 500): boolean {
  const energy = computeEnergy(pcmBuffer);
  return energy > threshold;
}

/**
 * 计算 PCM 缓冲区的 RMS 能量值
 * @param pcmBuffer - PCM 音频数据（Int16 格式）
 * @returns RMS 能量值
 */
export function computeEnergy(pcmBuffer: Int16Array): number {
  if (pcmBuffer.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < pcmBuffer.length; i++) {
    sum += pcmBuffer[i] * pcmBuffer[i];
  }

  const meanSquare = sum / pcmBuffer.length;
  return Math.sqrt(meanSquare);
}

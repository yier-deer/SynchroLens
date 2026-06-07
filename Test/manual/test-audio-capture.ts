/**
 * 音频采集手动测试脚本
 * 用于独立验证 AudioCapture 模块的系统音频和麦克风采集
 *
 * 运行方式: npx ts-node Test/manual/test-audio-capture.ts
 * 或: npx electron-vite dev 后查看日志
 */

import { AudioCapture } from '../../src/main/modules/audio/AudioCapture';

async function testAudioCapture() {
  console.log('=== 音频采集测试 ===\n');

  const audio = new AudioCapture();

  // 测试 1: 检查系统音频设备
  console.log('1. 检查可用音频设备...');
  const devices = await audio.getAvailableDevices();
  console.log('   设备列表:', JSON.stringify(devices, null, 2));

  // 测试 2: 系统音频采集（5秒）
  console.log('\n2. 测试系统音频采集 (5秒)...');
  let sampleCount = 0;
  const unsub = audio.onData((pcm) => {
    sampleCount++;
    if (sampleCount <= 3) {
      console.log(`   收到音频帧: ${pcm.length} samples, 前5个值: [${Array.from(pcm.slice(0, 5)).join(', ')}]`);
    }
  });

  try {
    await audio.start('system');
    console.log('   系统音频采集已启动，等待 5 秒...');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log(`   5秒内收到 ${sampleCount} 帧数据`);
    audio.stop();
    unsub();
    console.log('   系统音频采集已停止');
  } catch (err) {
    console.log('   系统音频采集失败:', (err as Error).message);
    console.log('   请确认:');
    console.log('   1. 安装了 ffmpeg 到系统 PATH');
    console.log('   2. 在 Windows 声音设置 → 录制设备 → 启用了 Stereo Mix');
  }

  // 测试 3: 麦克风采集（3秒）
  console.log('\n3. 测试麦克风采集 (3秒)...');
  sampleCount = 0;
  const unsub2 = audio.onData((pcm) => {
    sampleCount++;
  });

  try {
    await audio.start('microphone');
    console.log('   麦克风采集已启动，等待 3 秒...');

    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log(`   3秒内收到 ${sampleCount} 帧数据`);
    audio.stop();
    unsub2();
    console.log('   麦克风采集已停止');
  } catch (err) {
    console.log('   麦克风采集失败:', (err as Error).message);
  }

  console.log('\n=== 音频采集测试完成 ===');
}

testAudioCapture().catch(console.error);

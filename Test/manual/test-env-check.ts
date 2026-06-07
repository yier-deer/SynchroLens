/**
 * 环境预检脚本
 * 检查 SynchroLens 运行所需的所有系统依赖和配置
 *
 * 运行方式: npx ts-node Test/manual/test-env-check.ts
 */
import { execSync } from 'child_process';

console.log('=== SynchroLens 环境预检 ===\n');

// 1. ffmpeg
try {
  const ver = execSync('ffmpeg -version', { stdio: 'pipe', encoding: 'utf-8' });
  console.log('[OK] ffmpeg 已安装: ' + ver.split('\n')[0]);
} catch {
  console.log('[X] ffmpeg 未安装 — 系统音频采集需要 ffmpeg');
  console.log('    安装: choco install ffmpeg 或从 https://ffmpeg.org 下载');
}

// 2. sox
try {
  execSync('sox --version', { stdio: 'pipe' });
  console.log('[OK] sox 已安装');
} catch {
  console.log('[!] sox 未安装 — 麦克风采集备用方案不可用');
}

// 3. Node.js
console.log(`[OK] Node.js ${process.version}`);

// 4. npm 依赖
try {
  const pkg = require('../../package.json');
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  console.log(`[OK] package.json: ${Object.keys(deps).length} 个依赖`);
} catch {
  console.log('[X] package.json 读取失败');
}

// 5. .env 文件
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
const envPath = join(__dirname, '../../.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  const keys = envContent.split('\n')
    .filter(line => line.includes('=') && !line.trim().startsWith('#'))
    .map(line => line.split('=')[0].trim());

  console.log(`[OK] .env 文件存在，包含 ${keys.length} 个变量`);

  // 检查关键密钥
  const checks = [
    { key: 'XFYUN_APP_ID', name: '讯飞 AppID' },
    { key: 'XFYUN_API_KEY', name: '讯飞 API Key' },
    { key: 'XFYUN_API_SECRET', name: '讯飞 API Secret' },
    { key: 'DEEPSEEK_API_KEY', name: 'DeepSeek API Key' },
  ];
  for (const { key, name } of checks) {
    console.log(keys.includes(key) ? `[OK] ${name} 已配置` : `[!] ${name} 未配置`);
  }
} else {
  console.log('[!] .env 文件不存在');
}

// 6. Windows 音频设备（如果有 ffmpeg）
try {
  const output = execSync('ffmpeg -list_devices true -f dshow -i dummy', {
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: 5000,
  });
  const devices = output.match(/"([^"]+)"/g)?.map(m => m.replace(/"/g, '')) || [];
  console.log(`\n[OK] dshow 音频设备 (${devices.length}):`);
  for (const d of devices) {
    const isLoopback = ['stereo mix', '混音', 'loopback', 'cable', 'what u hear'].some(k =>
      d.toLowerCase().includes(k)
    );
    console.log(`    ${isLoopback ? '[回环]' : '  [输入]'} ${d}`);
  }
  if (!devices.some(d => ['stereo mix', '混音', 'loopback', 'cable', 'what u hear'].some(k => d.toLowerCase().includes(k)))) {
    console.log('  [!] 未找到回环设备，系统音频采集将不可用');
    console.log('      请在 Windows 声音设置 → 录制设备 → 右键 → 显示禁用的设备');
    console.log('      然后启用 Stereo Mix（立体声混音）');
  }
} catch {
  console.log('[!] 无法获取音频设备列表');
}

// 7. 火山引擎豆包向量 API
console.log('\n[提示] 向量模型配置:');
console.log('  API 地址: https://ark.cn-beijing.volces.com/api/v3');
console.log('  模型: doubao-embedding');
console.log('  API Key: 需在 https://console.volcengine.com/ark 申请');

console.log('\n=== 环境预检完成 ===');

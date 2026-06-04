# SynchroLens 测试策略文档

> 项目: SynchroLens — AI 同声传译助手
> 技术栈: Electron + React + TypeScript + TailwindCSS + Vite
> 测试框架: Jest + @testing-library/react
> 测试目录: `Test/`

---

## 1. 测试层级说明

### 1.1 单元测试

**目标**：验证各模块内部函数的逻辑正确性，确保输入输出符合预期。

**范围**：
- 纯函数和工具函数（重采样、格式化、VAD 判断等）
- 核心管道模块的内部逻辑（上下文窗口滑动、纠正检测算法等）
- 不依赖外部服务的计算逻辑

**原则**：
- 只 mock 外部依赖（文件系统、网络请求、WebSocket），被测模块内部逻辑不 mock
- 遵循 AAA（Arrange-Act-Assert）模式
- `describe` / `it` 使用中文命名，格式为"应该 <预期行为>"

### 1.2 集成测试

**目标**：验证模块间协作是否正确，数据在管道中流转是否符合预期。

**范围**：
- STT 结果 → 翻译请求构建的衔接
- 翻译结果 → 笔记写入的衔接
- IPC 消息在主进程与渲染进程间的收发
- 会话生命周期中各模块的协调

**原则**：
- mock 外部 API（讯飞 WebSocket、DeepSeek SSE），但保留模块间真实调用链
- 验证数据在流转过程中的完整性，不丢失字段、不篡改内容

### 1.3 E2E 测试

**目标**：验证完整翻译流程端到端可用，从音频输入到笔记输出。

**范围**：
- 音频采集 → STT → 翻译 → 纠正 → 笔记写入的完整链路
- 用户交互触发的完整会话流程（开始/暂停/结束）

**原则**：
- 使用 mock 的音频数据流和 mock API，但管道内部模块真实运行
- 验证最终输出（Markdown 文件内容）符合预期

---

## 2. 各模块测试用例清单

### 2.1 `audioResampler.ts` — 音频重采样工具

| 测试文件 | 函数 | 测试用例 |
|----------|------|----------|
| `Test/main/utils/audioResampler.test.ts` | `resample(inputBuffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Int16Array` | 应该将 48kHz Float32 PCM 正确重采样为 16kHz Int16 PCM |
| 同上 | `resample` | 应该处理空输入并返回空 Int16Array |
| 同上 | `resample` | 应该在输入采样率等于输出采样率时直接转换格式而不改变采样率 |
| 同上 | `resample` | 应该正确处理包含静音段（全零）的输入 |
| 同上 | `resample` | 应该在重采样后保持音频信号幅度在 Int16 范围内（-32768~32767） |

### 2.2 `vad.ts` — 语音活动检测

| 测试文件 | 函数 | 测试用例 |
|----------|------|----------|
| `Test/main/utils/vad.test.ts` | `detectVoiceActivity(pcmBuffer: Int16Array, threshold: number): boolean` | 应该在有语音信号（能量超过阈值）时返回 true |
| 同上 | `detectVoiceActivity` | 应该在静音段（能量低于阈值）时返回 false |
| 同上 | `detectVoiceActivity` | 应该正确处理全零缓冲区 |
| 同上 | `detectVoiceActivity` | 应该在阈值边界值处给出正确判断 |
| 同上 | `computeEnergy(pcmBuffer: Int16Array): number` | 应该正确计算 PCM 缓冲区的 RMS 能量值 |

### 2.3 `markdownFormatter.ts` — Markdown 格式化

| 测试文件 | 函数 | 测试用例 |
|----------|------|----------|
| `Test/main/utils/markdownFormatter.test.ts` | `formatSessionHeader(session: SessionInfo): string` | 应该生成包含会话标题、日期、语言的 Markdown 头部 |
| 同上 | `formatTranslationEntry(original: string, translated: string, timestamp: number): string` | 应该格式化单条翻译条目为 Markdown 列表项，包含原文、译文和时间戳 |
| 同上 | `formatCorrectionEntry(correction: CorrectionInfo): string` | 应该格式化纠正条目，标注被纠正的原文和修正后的译文 |
| 同上 | `buildMarkdownDocument(header: string, entries: string[]): string` | 应该将头部和条目列表组装为完整的 Markdown 文档 |
| 同上 | `buildMarkdownDocument` | 应该处理空条目列表，仅输出头部 |

### 2.4 `CorrectionDetector.ts` — 翻译一致性纠正检测

| 测试文件 | 函数 | 测试用例 |
|----------|------|----------|
| `Test/main/modules/CorrectionDetector.test.ts` | `checkConsistency(translations: TranslationPair[]): CorrectionResult[]` | 应该在连续翻译中出现同一术语不同译法时检测到不一致 |
| 同上 | `checkConsistency` | 应该在翻译完全一致时返回空数组 |
| 同上 | `checkConsistency` | 应该在翻译数量不足 5 句时不触发批量检查 |
| 同上 | `checkConsistency` | 应该在累积满 5 句时触发一次批量检查 |
| 同上 | `applyCorrections(translations: TranslationPair[], corrections: CorrectionResult[]): TranslationPair[]` | 应该将纠正结果应用到翻译对列表中，替换错误译文 |
| 同上 | `applyCorrections` | 应该在纠正列表为空时返回原列表不变 |

### 2.5 `Translator.ts` — 流式翻译模块

| 测试文件 | 函数 | 测试用例 |
|----------|------|----------|
| `Test/main/modules/Translator.test.ts` | `translate(text: string, context: TranslationPair[]): AsyncGenerator<string>` | 应该流式返回翻译结果（逐 token） |
| 同上 | `translate` | 应该将最近 5 句翻译作为上下文传入请求 |
| 同上 | `translate` | 应该在上下文超过 5 句时只保留最近 5 句（滑动窗口） |
| 同上 | `translate` | 应该在 DeepSeek API 返回错误时抛出可处理的异常 |
| 同上 | `buildContextWindow(recentTranslations: TranslationPair[], maxCount: number): string` | 应该从翻译对列表中构建上下文字符串 |
| 同上 | `buildContextWindow` | 应该在翻译对数量不足 maxCount 时使用全部可用翻译 |
| 同上 | `buildContextWindow` | 应该在翻译对为空时返回空字符串 |

### 2.6 `STTClient.ts` — 讯飞 WebSocket 连接管理

| 测试文件 | 函数 | 测试用例 |
|----------|------|----------|
| `Test/main/modules/STTClient.test.ts` | `connect(): void` | 应该建立 WebSocket 连接并发送鉴权帧 |
| 同上 | `sendAudio(pcmChunk: Int16Array): void` | 应该将 PCM 音频数据分帧发送到 WebSocket |
| 同上 | `disconnect(): void` | 应该发送结束帧并关闭 WebSocket 连接 |
| 同上 | `onResult(callback: (text: string, isFinal: boolean) => void): void` | 应该在收到中间结果时以 isFinal=false 回调 |
| 同上 | `onResult` | 应该在收到句结束信号时以 isFinal=true 回调完整句子 |
| 同上 | `onError(callback: (error: Error) => void): void` | 应该在连接异常时触发错误回调 |
| 同上 | `reconnect(): void` | 应该在连接断开后自动重连（最多 3 次） |

### 2.7 `AudioCapture.ts` — 音频采集模块

| 测试文件 | 函数 | 测试用例 |
|----------|------|----------|
| `Test/main/modules/AudioCapture.test.ts` | `start(deviceId: string): void` | 应该启动音频采集并开始输出 PCM 数据流 |
| 同上 | `stop(): void` | 应该停止音频采集并释放设备 |
| 同上 | `onData(callback: (pcmBuffer: Int16Array) => void): void` | 应该在采集到音频数据时回调 PCM 缓冲区 |
| 同上 | `getAvailableDevices(): DeviceInfo[]` | 应该返回可用的音频输入设备列表 |

### 2.8 `NoteWriter.ts` — Markdown 笔记生成

| 测试文件 | 函数 | 测试用例 |
|----------|------|----------|
| `Test/main/modules/NoteWriter.test.ts` | `writeSession(filePath: string, content: string): Promise<void>` | 应该将 Markdown 内容写入指定文件路径 |
| 同上 | `writeSession` | 应该在目录不存在时自动创建目录 |
| 同上 | `appendEntry(filePath: string, entry: string): Promise<void>` | 应该向已有文件追加翻译条目 |
| 同上 | `appendEntry` | 应该在文件不存在时创建新文件并写入条目 |
| 同上 | `generateFileName(session: SessionInfo): string` | 应该根据会话信息生成格式化的文件名（含日期和语言标识） |

### 2.9 `SessionManager.ts` — 会话生命周期管理

| 测试文件 | 函数 | 测试用例 |
|----------|------|----------|
| `Test/main/modules/SessionManager.test.ts` | `createSession(config: SessionConfig): Session` | 应该创建新会话并初始化所有管道模块 |
| 同上 | `startSession(sessionId: string): void` | 应该启动指定会话的音频采集和 STT |
| 同上 | `pauseSession(sessionId: string): void` | 应该暂停音频采集但保持 STT 连接 |
| 同上 | `resumeSession(sessionId: string): void` | 应该恢复音频采集 |
| 同上 | `endSession(sessionId: string): Promise<void>` | 应该停止所有模块、触发纠正检测、写入最终笔记并清理资源 |
| 同上 | `endSession` | 应该在会话结束时触发 CorrectionDetector 的最终检查 |
| 同上 | `getSessionState(sessionId: string): SessionState` | 应该返回当前会话状态（running/paused/stopped） |

---

## 3. 集成测试用例清单

### 3.1 STT → 翻译请求构建

| 测试文件 | 测试用例 |
|----------|----------|
| `Test/integration/stt-to-translator.test.ts` | 应该将 STT 的句结束结果传递给 Translator 并触发翻译请求 |
| 同上 | 应该在翻译请求中包含上下文窗口中的历史翻译 |
| 同上 | 应该在 STT 中间结果（非句结束）时不触发翻译 |

### 3.2 翻译 → 笔记写入

| 测试文件 | 测试用例 |
|----------|----------|
| `Test/integration/translator-to-notewriter.test.ts` | 应该将翻译完成的结果传递给 NoteWriter 写入文件 |
| 同上 | 应该在纠正检测后用纠正结果更新笔记文件 |
| 同上 | 应该在会话结束时写入包含纠正标注的最终笔记 |

### 3.3 IPC 消息收发

| 测试文件 | 测试用例 |
|----------|----------|
| `Test/integration/ipc-messaging.test.ts` | 应该通过 IPC 将 STT 中间结果发送到渲染进程实时显示 |
| 同上 | 应该通过 IPC 将翻译结果发送到渲染进程 |
| 同上 | 应该通过 IPC 将纠正通知发送到渲染进程 |
| 同上 | 应该正确处理渲染进程发来的开始/暂停/结束会话指令 |

### 3.4 会话生命周期协调

| 测试文件 | 测试用例 |
|----------|----------|
| `Test/integration/session-lifecycle.test.ts` | 应该在创建会话时按正确顺序初始化 AudioCapture → STTClient → Translator → NoteWriter |
| 同上 | 应该在结束会话时按正确顺序停止 AudioCapture → STTClient → 触发纠正 → NoteWriter 写入 → 清理 |
| 同上 | 应该在暂停/恢复会话时正确管理各模块状态 |

---

## 4. E2E 测试用例清单

| 测试文件 | 测试用例 |
|----------|----------|
| `Test/e2e/full-pipeline.test.ts` | 应该完成从音频输入到笔记输出的完整翻译流程 |
| 同上 | 应该在完整流程中正确处理多句连续翻译 |
| 同上 | 应该在完整流程中检测并纠正翻译不一致 |
| 同上 | 应该在会话暂停和恢复后继续正常工作 |
| 同上 | 应该在 API 异常时优雅降级，不丢失已翻译内容 |

---

## 5. Mock 策略

### 5.1 讯飞 STT WebSocket Mock

**目标**：模拟讯飞语音识别 WebSocket 的完整生命周期。

```typescript
// Test/helpers/mockXfyunWS.ts

/**
 * 讯飞 STT WebSocket Mock
 * 模拟逐词流入 + 句结束信号的完整行为
 */
export function createMockXfyunWS() {
  const listeners: Record<string, Function[]> = {};

  return {
    /** 模拟 WebSocket 实例 */
    ws: {
      send: jest.fn(),
      close: jest.fn(),
      on: (event: string, callback: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
      },
    },

    /**
     * 模拟逐词流入
     * @param words - 词语数组，如 ["今天", "天气", "很好"]
     * @param interval - 每词间隔（ms），默认 100
     */
    simulateWordStream: async (words: string[], interval = 100) => {
      let accumulated = '';
      for (const word of words) {
        accumulated += word;
        // 触发中间结果回调（isFinal=false）
        for (const cb of listeners['message'] || []) {
          cb(JSON.stringify({
            data: { result: { word: accumulated, isEnd: false } }
          }));
        }
        await new Promise(r => setTimeout(r, interval));
      }
    },

    /**
     * 模拟句结束信号
     * @param fullText - 完整句子文本
     */
    simulateSentenceEnd: (fullText: string) => {
      for (const cb of listeners['message'] || []) {
        cb(JSON.stringify({
          data: { result: { word: fullText, isEnd: true } }
        }));
      }
    },

    /** 模拟连接错误 */
    simulateError: (error: Error) => {
      for (const cb of listeners['error'] || []) {
        cb(error);
      }
    },

    /** 模拟连接关闭 */
    simulateClose: () => {
      for (const cb of listeners['close'] || []) {
        cb({ code: 1000, reason: 'Normal closure' });
      }
    },
  };
}
```

**使用方式**：
- 在 `STTClient` 测试中，将 `new WebSocket()` 替换为 `createMockXfyunWS().ws`
- 通过 `simulateWordStream` 模拟逐词识别过程
- 通过 `simulateSentenceEnd` 触发句结束，验证 `onResult` 回调的 `isFinal=true`

### 5.2 DeepSeek SSE 流式响应 Mock

**目标**：模拟 DeepSeek 翻译 API 的 Server-Sent Events 流式响应。

```typescript
// Test/helpers/mockDeepSeekSSE.ts

/**
 * DeepSeek SSE 流式响应 Mock
 * 模拟 token 逐个返回的 SSE 行为
 */
export function createMockDeepSeekSSE() {
  return {
    /**
     * 创建模拟的 SSE 响应流
     * @param tokens - 翻译结果的 token 数组，如 ["Hello", " world"]
     * @param interval - 每个 token 间隔（ms），默认 50
     * @returns 模拟的 Response 对象
     */
    createStreamResponse: (tokens: string[], interval = 50) => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          for (const token of tokens) {
            const sseChunk = `data: ${JSON.stringify({
              choices: [{
                delta: { content: token },
                finish_reason: null
              }]
            })}\n\n`;
            controller.enqueue(encoder.encode(sseChunk));
            await new Promise(r => setTimeout(r, interval));
          }
          // 发送结束标记
          const endChunk = `data: ${JSON.stringify({
            choices: [{
              delta: { content: '' },
              finish_reason: 'stop'
            }]
          })}\n\n`;
          controller.enqueue(encoder.encode(endChunk));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' }
      });
    },

    /**
     * 创建模拟的错误响应
     * @param statusCode - HTTP 状态码
     * @param message - 错误信息
     */
    createErrorResponse: (statusCode: number, message: string) => {
      return new Response(
        JSON.stringify({ error: { message } }),
        { status: statusCode, headers: { 'Content-Type': 'application/json' } }
      );
    },
  };
}
```

**使用方式**：
- 在 `Translator` 测试中，将 `fetch` 替换为返回 `createStreamResponse` 结果的 mock
- 通过 `tokens` 参数控制翻译结果的逐 token 返回
- 通过 `createErrorResponse` 模拟 API 错误场景

### 5.3 音频捕获 PCM 数据流 Mock

**目标**：模拟音频采集设备输出的 PCM 数据流。

```typescript
// Test/helpers/mockAudioCapture.ts

/**
 * 音频捕获 Mock
 * 模拟 PCM 16bit 16kHz 音频数据流
 */
export function createMockAudioCapture() {
  let dataCallback: ((buffer: Int16Array) => void) | null = null;

  return {
    /** 模拟的 AudioCapture 实例 */
    capture: {
      start: jest.fn(),
      stop: jest.fn(),
      onData: jest.fn((cb: (buffer: Int16Array) => void) => {
        dataCallback = cb;
      }),
      getAvailableDevices: jest.fn(() => [
        { deviceId: 'default', label: '默认麦克风' },
        { deviceId: 'usb-mic', label: 'USB 麦克风' },
      ]),
    },

    /**
     * 生成模拟的 PCM 数据
     * @param durationMs - 时长（毫秒）
     * @param sampleRate - 采样率，默认 16000
     * @param frequency - 模拟信号频率（Hz），0 表示静音
     * @returns Int16Array PCM 数据
     */
    generatePCMData: (durationMs: number, sampleRate = 16000, frequency = 440): Int16Array => {
      const sampleCount = Math.floor(sampleRate * durationMs / 1000);
      const buffer = new Int16Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        if (frequency === 0) {
          buffer[i] = 0; // 静音
        } else {
          buffer[i] = Math.floor(Math.sin(2 * Math.PI * frequency * i / sampleRate) * 16000);
        }
      }
      return buffer;
    },

    /**
     * 模拟推送音频数据
     * @param buffer - PCM 数据
     */
    pushData: (buffer: Int16Array) => {
      if (dataCallback) dataCallback(buffer);
    },

    /**
     * 模拟持续推送音频流
     * @param chunkCount - 数据块数量
     * @param chunkDurationMs - 每块时长（ms），默认 100
     * @param interval - 推送间隔（ms），默认 100
     */
    simulateStream: async (chunkCount: number, chunkDurationMs = 100, interval = 100) => {
      for (let i = 0; i < chunkCount; i++) {
        const pcm = createMockAudioCapture().generatePCMData(chunkDurationMs);
        if (dataCallback) dataCallback(pcm);
        await new Promise(r => setTimeout(r, interval));
      }
    },
  };
}
```

**使用方式**：
- 在 `AudioCapture` 和集成测试中，替换真实的音频采集为 mock 实例
- 通过 `generatePCMData` 生成指定参数的模拟音频数据
- 通过 `pushData` / `simulateStream` 模拟数据流入

### 5.4 文件系统 Mock

**目标**：避免测试中产生真实文件写入。

```typescript
// 在 NoteWriter 测试中 mock fs 模块
jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  appendFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockRejectedValue(new Error('ENOENT')), // 模拟文件不存在
}));
```

### 5.5 IPC Mock

**目标**：模拟 Electron IPC 通信。

```typescript
// Test/helpers/mockIPC.ts

/**
 * Electron IPC Mock
 * 模拟 ipcMain 和 ipcRenderer 的消息收发
 */
export function createMockIPC() {
  const handlers: Record<string, Function> = {};
  const sentMessages: { channel: string; data: any }[] = [];

  return {
    ipcMain: {
      handle: jest.fn((channel: string, handler: Function) => {
        handlers[channel] = handler;
      }),
      on: jest.fn((channel: string, handler: Function) => {
        handlers[channel] = handler;
      }),
    },
    ipcRenderer: {
      invoke: jest.fn(async (channel: string, ...args: any[]) => {
        if (handlers[channel]) return handlers[channel](null, ...args);
        throw new Error(`No handler for channel: ${channel}`);
      }),
      send: jest.fn((channel: string, data: any) => {
        sentMessages.push({ channel, data });
      }),
      on: jest.fn(),
    },
    /** 获取已发送的消息记录 */
    getSentMessages: () => sentMessages,
    /** 清空消息记录 */
    clearMessages: () => sentMessages.length = 0,
  };
}
```

---

## 6. 测试命令

```bash
# 运行全部测试
npm test

# 运行单元测试
npm test -- --testPathPattern="Test/main"

# 运行集成测试
npm test -- --testPathPattern="Test/integration"

# 运行 E2E 测试
npm test -- --testPathPattern="Test/e2e"

# 运行指定模块的测试
npm test -- --testPathPattern="audioResampler"

# 运行测试并生成覆盖率报告
npm test -- --coverage

# 运行测试并监视文件变更
npm test -- --watch

# 仅运行失败的测试
npm test -- --onlyFailures
```

### package.json 脚本配置

```json
{
  "scripts": {
    "test": "jest --config jest.config.ts",
    "test:unit": "jest --testPathPattern='Test/main'",
    "test:integration": "jest --testPathPattern='Test/integration'",
    "test:e2e": "jest --testPathPattern='Test/e2e'",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

### Jest 配置要点

```typescript
// jest.config.ts 关键配置
{
  roots: ['<rootDir>/Test'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    '^@renderer/(.*)$': '<rootDir>/src/renderer/$1',
  },
  collectCoverageFrom: [
    'src/main/modules/**/*.ts',
    'src/main/utils/**/*.ts',
    '!src/main/modules/**/*.d.ts',
  ],
  coverageThresholds: {
    // 见第 7 节覆盖率要求
  },
}
```

---

## 7. 覆盖率要求

### 7.1 总体目标

| 模块分类 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
|----------|----------|------------|------------|
| 核心管道模块 | ≥ 80% | ≥ 75% | ≥ 85% |
| 工具模块 | ≥ 70% | ≥ 65% | ≥ 75% |
| 集成测试覆盖 | — | — | — |

### 7.2 各模块覆盖率目标

#### 核心管道模块（≥ 80% 行覆盖率）

| 模块 | 目标行覆盖率 | 优先级 |
|------|-------------|--------|
| `AudioCapture.ts` | ≥ 80% | 高 |
| `STTClient.ts` | ≥ 80% | 高 |
| `Translator.ts` | ≥ 85% | 最高 |
| `CorrectionDetector.ts` | ≥ 85% | 最高 |
| `NoteWriter.ts` | ≥ 80% | 高 |
| `SessionManager.ts` | ≥ 80% | 高 |

#### 工具模块（≥ 70% 行覆盖率）

| 模块 | 目标行覆盖率 | 优先级 |
|------|-------------|--------|
| `audioResampler.ts` | ≥ 75% | 高 |
| `vad.ts` | ≥ 70% | 中 |
| `markdownFormatter.ts` | ≥ 75% | 高 |

### 7.3 Jest 覆盖率阈值配置

```typescript
// jest.config.ts 中的 coverageThreshold 配置
coverageThreshold: {
  global: {
    branches: 65,
    functions: 75,
    lines: 70,
    statements: 70,
  },
  // 核心管道模块的严格阈值
  'src/main/modules/': {
    branches: 75,
    functions: 85,
    lines: 80,
    statements: 80,
  },
  // 工具模块的阈值
  'src/main/utils/': {
    branches: 65,
    functions: 75,
    lines: 70,
    statements: 70,
  },
}
```

### 7.4 覆盖率不达标时的处理

- CI 流水线中覆盖率低于阈值时构建失败
- 新增代码必须同步补充测试，确保覆盖率不下降
- 每次合并 PR 前检查覆盖率变化趋势

---

## 8. 测试目录结构

```
Test/
├── main/
│   ├── modules/
│   │   ├── AudioCapture.test.ts
│   │   ├── STTClient.test.ts
│   │   ├── Translator.test.ts
│   │   ├── NoteWriter.test.ts
│   │   ├── CorrectionDetector.test.ts
│   │   └── SessionManager.test.ts
│   └── utils/
│       ├── audioResampler.test.ts
│       ├── vad.test.ts
│       └── markdownFormatter.test.ts
├── integration/
│   ├── stt-to-translator.test.ts
│   ├── translator-to-notewriter.test.ts
│   ├── ipc-messaging.test.ts
│   └── session-lifecycle.test.ts
├── e2e/
│   └── full-pipeline.test.ts
└── helpers/
    ├── mockXfyunWS.ts
    ├── mockDeepSeekSSE.ts
    ├── mockAudioCapture.ts
    └── mockIPC.ts
```

> 目录结构镜像 `src/`，`helpers/` 存放共享的 Mock 工具函数。

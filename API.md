# SynchroLens API 接口契约文档

> 本文档定义 SynchroLens 项目所有 IPC 通道与外部 API 的接口契约。
> IPC 通道定义与设计文档保持严格一致，外部 API 仅记录调用要点。

---

## 1. IPC 通道清单

### 1.1 Main → Renderer（主进程推送至渲染进程）

| 通道名 | 参数类型 | 返回值 | 触发时机 |
|--------|----------|--------|----------|
| `stt:partial` | `{ sentenceId: string, text: string, isFinal: false }` | 无 | 讯飞返回中间识别结果时推送，`isFinal` 始终为 `false` |
| `stt:sentence` | `{ sentenceId: string, text: string, timestamp: number }` | 无 | 讯飞返回一句完整识别结果时推送，`timestamp` 为句子结束的 Unix 毫秒时间戳 |
| `translate:partial` | `{ sentenceId: string, translation: string }` | 无 | DeepSeek 流式返回中间翻译片段时推送 |
| `translate:final` | `{ sentenceId: string, translation: string }` | 无 | DeepSeek 流式翻译完成时推送最终译文 |
| `translate:correct` | `{ sentenceId: string, oldTranslation: string, newTranslation: string, reason: string }` | 无 | DeepSeek 对已输出译文进行纠正时推送，含旧译文、新译文及纠正原因 |
| `note:saved` | `{ filePath: string }` | 无 | 笔记文件写入磁盘完成后推送，`filePath` 为绝对路径 |
| `note:summary` | `{ summary: string }` | 无 | 会话摘要生成完成后推送 |

### 1.2 Renderer → Main（渲染进程发往主进程）

| 通道名 | 参数类型 | 返回值 | 触发时机 |
|--------|----------|--------|----------|
| `session:start` | `{ audioSource: string }` | `Promise<Session>` | 用户点击"开始录制"时发送，`audioSource` 标识音频来源（如麦克风设备 ID） |
| `session:stop` | `{}` | `Promise<void>` | 用户点击"停止录制"时发送 |
| `session:pause` | `{}` | `Promise<void>` | 用户点击"暂停录制"时发送 |
| `config:update` | `{ sttKey?: string, llmKey?: string, [key: string]: any }` | `Promise<void>` | 用户在设置面板修改配置项时发送，仅传递变更字段 |
| `summary:trigger` | `{}` | `Promise<void>` | 用户点击"生成摘要"时发送 |

### 1.3 类型定义

```typescript
/** STT 中间结果 */
interface STTPartial {
  sentenceId: string;
  text: string;
  isFinal: false;
}

/** STT 完整句子 */
interface STTSentence {
  sentenceId: string;
  text: string;
  timestamp: number; // Unix 毫秒
}

/** 翻译中间结果 */
interface TranslatePartial {
  sentenceId: string;
  translation: string;
}

/** 翻译最终结果 */
interface TranslateFinal {
  sentenceId: string;
  translation: string;
}

/** 翻译纠正 */
interface TranslateCorrect {
  sentenceId: string;
  oldTranslation: string;
  newTranslation: string;
  reason: string;
}

/** 笔记保存通知 */
interface NoteSaved {
  filePath: string;
}

/** 笔记摘要通知 */
interface NoteSummary {
  summary: string;
}

/** 会话启动参数 */
interface SessionStartParams {
  audioSource: string;
}

/** 配置更新参数 */
interface ConfigUpdateParams {
  sttKey?: string;
  llmKey?: string;
  [key: string]: any;
}

/** 核心数据结构 — STT 结果 */
interface STTResult {
  sentenceId: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

/** 核心数据结构 — 翻译结果 */
interface TranslationResult {
  sentenceId: string;
  original: string;
  translation: string;
  isFinal: boolean;
  corrections: Correction[];
}

/** 核心数据结构 — 纠正记录 */
interface Correction {
  from: string;
  to: string;
  reason: string;
  timestamp: number;
}

/** 核心数据结构 — 会话 */
interface Session {
  id: string;
  startTime: number;
  endTime?: number;
  audioSource: string;
  sentences: STTResult[];
  notePath?: string;
  summary?: string;
}
```

---

## 2. 讯飞 WebSocket 实时转写 API

### 2.1 连接信息

| 项目 | 值 |
|------|----|
| 协议 | WSS |
| 接入地址 | `wss://iat-api.xfyun.cn/v2/iat` |
| 鉴权方式 | URL 参数签名（APIKey + APISecret + HMAC-SHA256） |

### 2.2 鉴权流程

1. 生成 RFC 3339 格式时间戳 `ts`（如 `2024-01-01T00:00:00+08:00`）
2. 拼接签名原文 `signatureOrigin = "host: iat-api.xfyun.cn\ndate: {ts}\nGET /v2/iat HTTP/1.1"`
3. 使用 APISecret 对 `signatureOrigin` 做 HMAC-SHA256 签名，得到 `signature`
4. 对 `signature` 做 Base64 编码
5. 拼接 `authorization = apikey="{APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature_base64}"`
6. 对 `authorization` 做 URL 编码后作为查询参数附加到 WebSocket URL

最终 URL 格式：
```
wss://iat-api.xfyun.cn/v2/iat?authorization={url_encoded_auth}&date={url_encoded_ts}&host=iat-api.xfyun.cn
```

### 2.3 音频格式要求

| 项目 | 值 |
|------|----|
| 编码格式 | PCM（原始音频） |
| 采样位深 | 16 bit |
| 采样率 | 16 kHz |
| 声道数 | 单声道 |

### 2.4 数据帧规范

- 帧间隔：40ms / 帧
- 帧大小：640 bytes（= 16000 × 0.04 × 2）
- 首帧需携带业务参数（`common` + `business` + `data`），后续帧仅携带 `data`
- 最后一帧 `data.status` 设为 `2` 表示结束

**首帧 JSON 结构：**
```json
{
  "common": { "app_id": "你的APPID" },
  "business": {
    "language": "zh_cn",
    "domain": "iat",
    "accent": "mandarin",
    "vad_eos": 2000,
    "dwa": "wpgs"
  },
  "data": {
    "status": 0,
    "format": "audio/L16;rate=16000",
    "encoding": "raw",
    "audio": "<Base64编码的PCM数据>"
  }
}
```

**后续帧 JSON 结构：**
```json
{
  "data": {
    "status": 1,
    "format": "audio/L16;rate=16000",
    "encoding": "raw",
    "audio": "<Base64编码的PCM数据>"
  }
}
```

**末帧 JSON 结构：**
```json
{
  "data": {
    "status": 2,
    "format": "audio/L16;rate=16000",
    "encoding": "raw",
    "audio": ""
  }
}
```

### 2.5 响应格式

```json
{
  "code": 0,
  "message": "success",
  "sid": "iat000xxxxx@xxxx",
  "data": {
    "result": {
      "bg": 1,
      "ls": false,
      "pgs": "apd",
      "rg": [1, 10],
      "sn": 1,
      "ws": [
        {
          "bg": 0,
          "cw": [
            {
              "w": "今天",
              "wpgs": "n"
            }
          ]
        }
      ]
    },
    "isEnd": 0
  }
}
```

- `pgs`：`apd` = 追加结果，`rpl` = 替换结果（纠正场景）
- `rg`：替换范围，仅在 `pgs=rpl` 时有效
- `ls`：是否为最终结果

### 2.6 超时与限制

| 项目 | 值 |
|------|----|
| 连接超时 | 10 秒 |
| 单次会话最长时长 | 60 秒 |
| 超时处理 | 超时后需重新建立连接，通过 `stt:sentence` 通知渲染进程当前句子结束 |

### 2.7 常见错误码

| 错误码 | 含义 | 处理建议 |
|--------|------|----------|
| 10105 | 非法访问 | 检查 APPID / APIKey / APISecret 是否正确 |
| 10106 | 无效参数 | 检查业务参数格式 |
| 10107 | 非法参数 | 检查音频格式、采样率等 |
| 10110 | 无授权 | 检查账号是否开通实时转写服务 |
| 10114 | 引擎未授权 | 联系商务开通相应引擎权限 |
| 10700 | 引擎错误 | 重试或联系讯飞技术支持 |
| 11200 | 授权错误 | 检查鉴权参数 |
| 11201 | 授权过期 | 重新生成鉴权参数 |

---

## 3. DeepSeek Chat Completions API

### 3.1 连接信息

| 项目 | 值 |
|------|----|
| 协议 | HTTPS + SSE |
| 接入地址 | `https://api.deepseek.com/v1/chat/completions` |
| 鉴权方式 | Bearer Token（Header: `Authorization: Bearer {API_KEY}`） |
| 模型 | `deepseek-chat` |
| 流式 | `stream: true` |

### 3.2 System Prompt 设计

```
你是一个专业的实时翻译助手。你的任务是将用户提供的中文语音识别文本翻译成自然流畅的英文。

规则：
1. 保持原文语义，不增删信息
2. 译文需符合英文表达习惯，避免直译
3. 如果之前的翻译有误或需要调整，请用 correction 格式输出纠正
4. 每次只翻译当前提供的句子，不要重复之前的翻译
5. 对于专业术语，采用通用译法

输出格式：
- 正常翻译：直接输出英文译文
- 纠正翻译：输出 JSON 格式 {"correction": {"from": "旧译文", "to": "新译文", "reason": "纠正原因"}}
```

### 3.3 请求参数

```typescript
interface DeepSeekRequest {
  model: "deepseek-chat";
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  stream: true;
  temperature?: number;   // 默认 1.0，翻译场景建议 0.3
  max_tokens?: number;    // 建议根据句子长度动态设置
  top_p?: number;         // 默认 1.0
  frequency_penalty?: number; // 默认 0
  presence_penalty?: number;  // 默认 0
}
```

**翻译请求示例：**
```json
{
  "model": "deepseek-chat",
  "messages": [
    { "role": "system", "content": "<System Prompt 内容>" },
    { "role": "user", "content": "请翻译：今天天气很好，我们出去走走吧。" }
  ],
  "stream": true,
  "temperature": 0.3
}
```

**带上下文的纠正请求示例：**
```json
{
  "model": "deepseek-chat",
  "messages": [
    { "role": "system", "content": "<System Prompt 内容>" },
    { "role": "user", "content": "请翻译：他去了银行。" },
    { "role": "assistant", "content": "He went to the bank." },
    { "role": "user", "content": "上下文补充：这里的银行是河岸的意思。请纠正之前的翻译。" }
  ],
  "stream": true,
  "temperature": 0.3
}
```

### 3.4 流式响应格式

每个 SSE 事件格式：
```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":"He"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":" went"},"finish_reason":null}]}

data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","created":1234567890,"model":"deepseek-chat","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `choices[0].delta.content` | `string \| null` | 增量文本片段，拼接后得到完整译文 |
| `choices[0].finish_reason` | `string \| null` | `null` = 未结束，`"stop"` = 正常结束 |
| `data: [DONE]` | — | 流结束标记 |

### 3.5 流式响应处理流程

1. 建立 HTTPS 连接，发送请求
2. 逐行读取 SSE 事件
3. 解析 `delta.content`，拼接为当前翻译片段
4. 每收到一个 `delta.content`，通过 `translate:partial` 推送到渲染进程
5. 收到 `finish_reason: "stop"` 时，通过 `translate:final` 推送最终译文
6. 如果译文包含纠正 JSON，解析后通过 `translate:correct` 推送

### 3.6 摘要生成请求

```json
{
  "model": "deepseek-chat",
  "messages": [
    {
      "role": "system",
      "content": "你是一个会议摘要助手。请根据提供的会议记录生成简洁的摘要，包含：1）主要议题 2）关键结论 3）待办事项（如有）。"
    },
    {
      "role": "user",
      "content": "请为以下会议记录生成摘要：\n\n<会话句子列表>"
    }
  ],
  "stream": false,
  "temperature": 0.5
}
```

摘要生成完成后通过 `note:summary` 推送到渲染进程。

### 3.7 错误处理

| HTTP 状态码 | 含义 | 处理建议 |
|-------------|------|----------|
| 401 | 认证失败 | 检查 API Key 是否正确 |
| 429 | 请求频率超限 | 实现指数退避重试，最大重试 3 次 |
| 500 | 服务器内部错误 | 重试一次，仍失败则跳过当前句子翻译 |
| 503 | 服务不可用 | 稍后重试 |

**重试策略：**
- 初始间隔：1 秒
- 退避因子：2
- 最大重试次数：3
- 最大间隔：8 秒

---

## 4. 通道与外部 API 映射关系

| IPC 通道 | 触发的外部 API | 数据流向 |
|----------|---------------|----------|
| `session:start` | 建立讯飞 WebSocket 连接 | Renderer → Main → 讯飞 |
| `session:stop` | 关闭讯飞 WebSocket 连接 | Renderer → Main → 讯飞 |
| `session:pause` | 暂停向讯飞发送音频帧 | Renderer → Main → 讯飞 |
| — | 讯飞返回中间结果 | 讯飞 → Main → `stt:partial` → Renderer |
| — | 讯飞返回完整句子 | 讯飞 → Main → `stt:sentence` → Renderer |
| `stt:sentence` 触发 | 调用 DeepSeek 翻译 API | Main → DeepSeek |
| — | DeepSeek 返回中间片段 | DeepSeek → Main → `translate:partial` → Renderer |
| — | DeepSeek 返回最终译文 | DeepSeek → Main → `translate:final` → Renderer |
| — | DeepSeek 返回纠正 | DeepSeek → Main → `translate:correct` → Renderer |
| `summary:trigger` | 调用 DeepSeek 摘要 API | Renderer → Main → DeepSeek |
| — | 摘要生成完成 | DeepSeek → Main → `note:summary` → Renderer |
| — | 笔记写入完成 | Main → `note:saved` → Renderer |

---

*文档版本：1.0*
*最后更新：2026-06-05*

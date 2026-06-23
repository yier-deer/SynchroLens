# XFYun RTASR STT Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not use subagents, delegation, or parallel agents for this project unless the user explicitly changes that rule.

**Goal:** Replace the live-caption main STT path with a cloud realtime XFYun RTASR / realtime-ASR provider while preserving the existing audio capture, partial translation, final translation, and final-only sidecar boundaries.

**Architecture:** Introduce a provider-neutral STT client contract, keep the current XFYun IAT client as a fallback provider, and add a new RTASR client selected by config. Audio capture stays as 16 kHz mono PCM / 40 ms frames. RTASR emits partial/stable/final STT events through the existing `SessionManager` path, while notes, knowledge retrieval, correction, recommendation, and summaries remain final-only.

**Tech Stack:** Electron main process, TypeScript, Jest, `ws`, Node `crypto`, existing ffmpeg dshow audio capture, XFYun RTASR WebSocket API.

---

## Hard Boundaries

- Single agent only. Do not start subagents, delegate, or run parallel agent work.
- Do not modify `E:\Trae\Project\七牛云\SynchroLens`.
- Do not reset, stash, checkout, rebase, or revert unrelated existing changes.
- Do not store secrets, API keys, app IDs, signatures, raw credential files, or private audio samples in docs/tests/logs.
- Preserve final-only sidecars: notes, context memory, knowledge retrieval, correction, recommendation, and summary.
- Keep the main realtime chain bounded as:
  `AudioCapture -> AudioFrameBuffer -> STT provider -> SentenceAssembler -> SessionManager -> TranslationGateway -> NMTTranslator/Tencent TMT -> translate events`.
- Do not implement local Whisper/SimulStreaming in this phase. Leave that as a later provider behind the same abstraction.

## Current Evidence To Preserve In Tests

- `logs/synchrolens-2026-06-22.log:20617-20700`: IAT first audio frame to first STT partial was about 33 seconds, with a WebSocket disconnect and dropped audio during reconnect.
- `logs/synchrolens-2026-06-23.log:29-38`: first result latency improved to `3546ms`, but still depends on IAT behavior.
- `logs/synchrolens-2026-06-23.log:54-56`: final STT emitted only `"."`, showing the current result parser/assembler is not robust enough for correction-style provider output.

## File Structure

Create:

- `src/main/modules/stt/types.ts` - shared STT config, provider enum, provider-neutral client contract, result metadata.
- `src/main/modules/stt/XfyunIatClient.ts` - move the current `STTClient` implementation here with minimal behavior changes.
- `src/main/modules/stt/XfyunRtasrClient.ts` - new RTASR/realtime-ASR WebSocket client.
- `src/main/modules/stt/STTClientFactory.ts` - config-based provider selection.
- `Test/main/modules/XfyunIatClient.test.ts` - renamed/moved current IAT tests.
- `Test/main/modules/XfyunRtasrClient.test.ts` - RTASR auth, frames, parser, close/reconnect, metrics tests.
- `Test/main/modules/STTClientFactory.test.ts` - provider-selection tests.

Modify:

- `src/main/modules/stt/STTClient.ts` - convert to compatibility export or thin wrapper around the factory/default IAT client.
- `src/shared/types.ts` - extend `STTConfig.provider` to include RTASR and optional provider-specific fields.
- `src/shared/constants.ts` - add RTASR URL/latency thresholds while keeping IAT constants.
- `src/main/modules/session/SessionManager.ts` - import the provider-neutral type and avoid IAT-specific assumptions.
- `src/main/mainEntry.ts` - instantiate STT through the factory and pass saved config.
- `src/main/modules/config/ConfigStore.ts` - normalize/default STT provider to RTASR for realtime use without breaking existing saved IAT credentials.
- `src/renderer/components/SettingsPanel/SettingsPanel.tsx` - expose realtime STT provider choice and label RTASR as recommended.
- Existing tests under `Test/main`, `Test/renderer`, and `Test/shared` that assert STT provider values or instantiate `STTClient`.

## Provider Design

Use these contracts consistently:

```ts
// src/main/modules/stt/types.ts
export type STTProvider = 'xfyun-rtasr' | 'xfyun-iat' | 'whisper-local' | 'whisper-api';

export interface STTCredentials {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

export interface STTConnectOptions extends STTCredentials {
  language: string;
  provider?: STTProvider;
}

export interface STTResultMetadata {
  provider: STTProvider;
  sequence?: number;
  stable?: boolean;
  revision?: boolean;
  firstAudioFrameLatencyMs?: number;
  rawStatus?: number | string;
}

export type STTResultCallback = (
  text: string,
  isFinal: boolean,
  sentenceId: string,
  metadata?: STTResultMetadata,
) => void;

export type STTErrorCallback = (error: Error) => void;
export type STTCloseCallback = () => void;
export type STTClientState = 'connecting' | 'connected' | 'recognizing' | 'reconnecting' | 'failed';
export type STTStateCallback = (state: STTClientState) => void;

export interface ISTTClient {
  connect(config: STTConnectOptions): void;
  sendAudio(pcmChunk: Int16Array): void;
  disconnect(): void;
  onResult(callback: STTResultCallback): void;
  onError?(callback: STTErrorCallback): void;
  onClose?(callback: STTCloseCallback): void;
  onStateChange?(callback: STTStateCallback): void;
  setLanguage?(language: string): void;
  language?: string;
  readonly isConnected: boolean;
}
```

Keep `SessionManager` backward-compatible: it may ignore `metadata` for now, but tests should prove the extra callback argument does not break the existing flow.

## Task 1: Extract Provider-Neutral STT Types

**Files:**
- Create: `src/main/modules/stt/types.ts`
- Modify: `src/main/modules/session/SessionManager.ts`
- Modify: `src/main/modules/stt/STTClient.ts`
- Test: `Test/main/modules/SessionManager.test.ts`

- [ ] **Step 1: Write the failing contract test**

Add a test to `Test/main/modules/SessionManager.test.ts` proving `SessionManager` tolerates STT callbacks with metadata:

```ts
it('accepts provider metadata on STT results without changing transcript behavior', async () => {
  const session = manager.createSession('system');
  const transcriptCallback = jest.fn();
  manager.onSessionSTTPartial(transcriptCallback);

  await manager.startSession(session);
  emitSTT('hello from rtasr', false, 'rtasr-1', {
    provider: 'xfyun-rtasr',
    sequence: 1,
    stable: false,
  });

  expect(transcriptCallback).toHaveBeenCalledWith(
    session.id,
    expect.objectContaining({
      sentenceId: 'rtasr-1',
      text: 'hello from rtasr',
      isFinal: false,
    }),
  );
});
```

If the local helper `emitSTT` currently accepts only three arguments, update the test helper signature in the test file:

```ts
function emitSTT(
  text: string,
  isFinal: boolean,
  sentenceId: string,
  metadata?: import('../../../src/main/modules/stt/types').STTResultMetadata,
): void {
  sttResultCallback?.(text, isFinal, sentenceId, metadata);
}
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```powershell
npm.cmd test -- Test/main/modules/SessionManager.test.ts --runInBand
```

Expected: TypeScript/Jest fails because the STT callback contract does not accept the metadata argument yet, or the helper cannot type the metadata.

- [ ] **Step 3: Add provider-neutral types**

Create `src/main/modules/stt/types.ts` with the contract shown in **Provider Design**.

- [ ] **Step 4: Update `SessionManager` to import the contract**

In `src/main/modules/session/SessionManager.ts`, replace the local `STTClientState` import and local callback type assumptions with:

```ts
import type { ISTTClient, STTClientState } from '../stt/types';
```

Then remove the local `interface ISTTClient` block and use the imported `ISTTClient` in `SessionDependencies`.

Do not change translation, notes, enhancement, or queue behavior in this task.

- [ ] **Step 5: Keep the current `STTClient` compatible**

In `src/main/modules/stt/STTClient.ts`, import the callback/state types:

```ts
import type {
  STTClientState,
  STTConnectOptions,
  STTErrorCallback,
  STTResultCallback,
  STTStateCallback,
  STTCloseCallback,
  ISTTClient,
} from './types';
```

Change the class declaration:

```ts
export class STTClient implements ISTTClient {
```

Change `connect(config: STTConfig): void` to:

```ts
connect(config: STTConnectOptions): void
```

Keep the existing runtime behavior.

- [ ] **Step 6: Run focused tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/main/modules/SessionManager.test.ts Test/main/modules/STTClient.test.ts --runInBand
```

Expected: both suites pass.

## Task 2: Preserve IAT As A Named Fallback Client

**Files:**
- Create: `src/main/modules/stt/XfyunIatClient.ts`
- Modify: `src/main/modules/stt/STTClient.ts`
- Rename/modify test: `Test/main/modules/XfyunIatClient.test.ts`
- Modify test: `Test/main/modules/STTClient.test.ts`

- [ ] **Step 1: Write the failing import test**

Create `Test/main/modules/XfyunIatClient.test.ts` by copying the current `Test/main/modules/STTClient.test.ts`, then change the import:

```ts
import { XfyunIatClient } from '../../../src/main/modules/stt/XfyunIatClient';
```

Change construction:

```ts
let sttClient: XfyunIatClient;
sttClient = new XfyunIatClient();
```

Add one explicit test for English dynamic-correction gating:

```ts
it('does not enable XFYun dynamic correction for English IAT sessions', () => {
  sttClient.setLanguage('en_us');
  sttClient.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });

  triggerEvent('open');

  const firstFrame = JSON.parse(mockWsSend.mock.calls[0][0]);
  expect(firstFrame.business.language).toBe('en_us');
  expect(firstFrame.business.dwa).toBeUndefined();
});
```

- [ ] **Step 2: Run the new test to verify RED**

Run:

```powershell
npm.cmd test -- Test/main/modules/XfyunIatClient.test.ts --runInBand
```

Expected: FAIL because `XfyunIatClient.ts` does not exist.

- [ ] **Step 3: Move current IAT implementation**

Create `src/main/modules/stt/XfyunIatClient.ts` by moving the current implementation from `src/main/modules/stt/STTClient.ts`.

Rename:

```ts
export class XfyunIatClient implements ISTTClient {
```

Keep the current auth URL and IAT parsing, but change first-frame business params:

```ts
const business: Record<string, unknown> = {
  language: this.language,
  domain: 'iat',
  accent: 'mandarin',
  eos: 1500,
};

if (this.language.toLowerCase().startsWith('zh')) {
  business.dwa = 'wpgs';
}
```

Do not keep `vad_eos`; use documented `eos` for IAT fallback.

- [ ] **Step 4: Convert `STTClient.ts` to compatibility export**

Replace `src/main/modules/stt/STTClient.ts` with:

```ts
export { XfyunIatClient as STTClient } from './XfyunIatClient';
export type {
  ISTTClient,
  STTClientState,
  STTConnectOptions,
  STTResultCallback,
  STTResultMetadata,
} from './types';
```

- [ ] **Step 5: Keep old STTClient tests as compatibility smoke**

Simplify `Test/main/modules/STTClient.test.ts` to only assert the compatibility export constructs:

```ts
import { STTClient } from '../../../src/main/modules/stt/STTClient';

describe('STTClient compatibility export', () => {
  it('constructs the XFYun IAT fallback client', () => {
    expect(new STTClient()).toBeDefined();
  });
});
```

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/main/modules/XfyunIatClient.test.ts Test/main/modules/STTClient.test.ts --runInBand
```

Expected: both suites pass.

## Task 3: Add XFYun RTASR Client Skeleton, Auth, And Audio Frames

**Files:**
- Create: `src/main/modules/stt/XfyunRtasrClient.ts`
- Test: `Test/main/modules/XfyunRtasrClient.test.ts`
- Modify: `src/shared/constants.ts`

- [ ] **Step 1: Write RED tests for URL/auth and frame sending**

Create `Test/main/modules/XfyunRtasrClient.test.ts` with `ws`, `crypto`, and logger mocks modeled after `XfyunIatClient.test.ts`.

Test 1:

```ts
it('connects to the RTASR websocket endpoint with appid, ts, and signa query params', () => {
  jest.setSystemTime(new Date('2026-06-23T10:00:00.000Z'));
  const client = new XfyunRtasrClient();

  client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });

  expect(MockWebSocket).toHaveBeenCalledTimes(1);
  const url = String(MockWebSocket.mock.calls[0][0]);
  expect(url).toContain('wss://rtasr.xfyun.cn/v1/ws');
  expect(url).toContain('appid=test-app');
  expect(url).toContain('ts=');
  expect(url).toContain('signa=');
});
```

Test 2:

```ts
it('sends raw PCM bytes while connected', () => {
  const client = new XfyunRtasrClient();
  client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
  triggerEvent('open');

  client.sendAudio(new Int16Array([1, -1, 2, -2]));

  expect(mockWsSend).toHaveBeenCalledTimes(1);
  const sent = mockWsSend.mock.calls[0][0] as Buffer;
  expect(Buffer.isBuffer(sent)).toBe(true);
  expect(sent.byteLength).toBe(8);
});
```

Test 3:

```ts
it('sends end marker before closing', () => {
  const client = new XfyunRtasrClient();
  client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
  triggerEvent('open');
  mockWsSend.mockClear();

  client.disconnect();

  expect(mockWsSend).toHaveBeenCalledWith(expect.stringContaining('{"end":true}'));
  expect(mockWsClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run RTASR tests to verify RED**

Run:

```powershell
npm.cmd test -- Test/main/modules/XfyunRtasrClient.test.ts --runInBand
```

Expected: FAIL because `XfyunRtasrClient` does not exist.

- [ ] **Step 3: Add RTASR constants**

In `src/shared/constants.ts`, add:

```ts
RTASR_WS_URL: 'wss://rtasr.xfyun.cn/v1/ws',
FIRST_PARTIAL_TARGET_MS: 2000,
FIRST_PARTIAL_P95_TARGET_MS: 3000,
```

Keep `WS_URL` for IAT fallback.

- [ ] **Step 4: Implement `XfyunRtasrClient` skeleton**

Create `src/main/modules/stt/XfyunRtasrClient.ts`.

Required implementation details:

- Implement `ISTTClient`.
- Auth URL shape: `wss://rtasr.xfyun.cn/v1/ws?appid=<appId>&ts=<unixSeconds>&signa=<encodedSigna>`.
- Build `signa` in a helper and unit-test via URL presence, not exact secret material.
- Use `ws.send(Buffer.from(pcmChunk.buffer, pcmChunk.byteOffset, pcmChunk.byteLength))` for audio frames.
- Record `firstAudioFrameSentAt`, `firstResultReceivedAt`, `audioFrameCount`, `droppedFrameCount`, and `messageCount`, matching IAT observability.
- On close, log `STT WebSocket close metadata` with provider `xfyun-rtasr`, code, reason, audio frames, dropped frames, and total messages.
- On manual disconnect, send an end marker JSON string before closing. If official account docs for the active RTASR product require a different end marker, update this one line during implementation and record the doc evidence in the final report.

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/main/modules/XfyunRtasrClient.test.ts --runInBand
```

Expected: pass.

## Task 4: Parse RTASR Partial, Stable, Final, And Error Messages

**Files:**
- Modify: `src/main/modules/stt/XfyunRtasrClient.ts`
- Test: `Test/main/modules/XfyunRtasrClient.test.ts`

- [ ] **Step 1: Add RED parser tests**

Add these tests:

```ts
it('emits partial RTASR text messages with provider metadata', () => {
  const client = new XfyunRtasrClient();
  const resultCallback = jest.fn();
  client.onResult(resultCallback);
  client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
  triggerEvent('open');

  triggerEvent('message', JSON.stringify({ action: 'result', data: 'hello world', sid: 'sid-1' }));

  expect(resultCallback).toHaveBeenCalledWith(
    'hello world',
    false,
    expect.any(String),
    expect.objectContaining({ provider: 'xfyun-rtasr', stable: false }),
  );
});

it('emits final text when RTASR marks the stream complete', () => {
  const client = new XfyunRtasrClient();
  const resultCallback = jest.fn();
  client.onResult(resultCallback);
  client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
  triggerEvent('open');

  triggerEvent('message', JSON.stringify({ action: 'result', data: 'final text', type: 'final' }));

  expect(resultCallback).toHaveBeenCalledWith(
    'final text',
    true,
    expect.any(String),
    expect.objectContaining({ provider: 'xfyun-rtasr', stable: true }),
  );
});

it('reports RTASR error messages through onError', () => {
  const client = new XfyunRtasrClient();
  const errorCallback = jest.fn();
  client.onError(errorCallback);
  client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
  triggerEvent('open');

  triggerEvent('message', JSON.stringify({ action: 'error', code: '10105', desc: 'illegal access' }));

  expect(errorCallback).toHaveBeenCalledWith(expect.any(Error));
  expect(errorCallback.mock.calls[0][0].message).toContain('10105');
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```powershell
npm.cmd test -- Test/main/modules/XfyunRtasrClient.test.ts --runInBand
```

Expected: parser tests fail.

- [ ] **Step 3: Implement tolerant RTASR parsing**

In `XfyunRtasrClient`, implement `handleMessage(data: WebSocket.Data)` with these rules:

- If JSON has `action === 'error'` or non-zero `code`, emit an Error.
- Accept `data` as:
  - plain text string,
  - JSON string containing a recognized text field,
  - object with `text`, `cn.st.rt[].ws[].cw[].w`, or `result`.
- Consider final if any of these hold:
  - `type === 'final'`,
  - `isFinal === true`,
  - `action === 'end'`,
  - provider field says final/end.
- Emit the same `sentenceId` for one continuous RTASR segment until final, then rotate to a new id.
- Log first-result latency exactly once per connection.

Keep this parser tolerant because XFYun RTASR variants and account/product versions may differ in envelope shape. Do not expose raw long response bodies in logs.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/main/modules/XfyunRtasrClient.test.ts --runInBand
```

Expected: pass.

## Task 5: Add STT Client Factory And Select RTASR By Config

**Files:**
- Create: `src/main/modules/stt/STTClientFactory.ts`
- Modify: `src/main/mainEntry.ts`
- Test: `Test/main/modules/STTClientFactory.test.ts`
- Test: `Test/main/mainEntry.test.ts`

- [ ] **Step 1: Write RED factory tests**

Create `Test/main/modules/STTClientFactory.test.ts`:

```ts
import { createSTTClient } from '../../../src/main/modules/stt/STTClientFactory';
import { XfyunRtasrClient } from '../../../src/main/modules/stt/XfyunRtasrClient';
import { XfyunIatClient } from '../../../src/main/modules/stt/XfyunIatClient';

describe('createSTTClient', () => {
  it('creates RTASR client for xfyun-rtasr provider', () => {
    expect(createSTTClient({ provider: 'xfyun-rtasr' })).toBeInstanceOf(XfyunRtasrClient);
  });

  it('creates IAT fallback client for xfyun-iat provider', () => {
    expect(createSTTClient({ provider: 'xfyun-iat' })).toBeInstanceOf(XfyunIatClient);
  });

  it('defaults to RTASR for realtime captions', () => {
    expect(createSTTClient({})).toBeInstanceOf(XfyunRtasrClient);
  });
});
```

- [ ] **Step 2: Run factory test to verify RED**

Run:

```powershell
npm.cmd test -- Test/main/modules/STTClientFactory.test.ts --runInBand
```

Expected: FAIL because factory does not exist.

- [ ] **Step 3: Implement factory**

Create `src/main/modules/stt/STTClientFactory.ts`:

```ts
import type { AppConfig } from '../../../shared/types';
import type { ISTTClient } from './types';
import { XfyunIatClient } from './XfyunIatClient';
import { XfyunRtasrClient } from './XfyunRtasrClient';

export function createSTTClient(config?: Partial<AppConfig['stt']>): ISTTClient {
  switch (config?.provider) {
    case 'xfyun-iat':
      return new XfyunIatClient();
    case 'xfyun-rtasr':
    case undefined:
      return new XfyunRtasrClient();
    default:
      return new XfyunRtasrClient();
  }
}
```

- [ ] **Step 4: Update `mainEntry`**

In `src/main/mainEntry.ts`, replace:

```ts
const sttClient = new STTClient();
```

with a config-aware flow:

```ts
configStore = new ConfigStore();
const savedConfig = configStore.load();
const sttClient = createSTTClient(savedConfig.stt);
```

Avoid loading config twice in a way that changes side effects. If current initialization order makes this awkward, keep the first `configStore = new ConfigStore()` before STT construction and reuse the same `savedConfig` later.

Import:

```ts
import { createSTTClient } from './modules/stt/STTClientFactory';
```

Remove the direct runtime dependency on `new STTClient()` from app startup.

- [ ] **Step 5: Update mainEntry tests**

In `Test/main/mainEntry.test.ts`, adjust mocks so `STTClientFactory` returns the existing mocked STT client object. Use this mock shape:

```ts
jest.mock('../../src/main/modules/stt/STTClientFactory', () => ({
  createSTTClient: jest.fn(() => ({
    connect: jest.fn(),
    sendAudio: jest.fn(),
    disconnect: jest.fn(),
    onResult: jest.fn(),
    onError: jest.fn(),
    onClose: jest.fn(),
    onStateChange: jest.fn(),
    setLanguage: jest.fn(),
    get isConnected() {
      return true;
    },
  })),
}));
```

Add an assertion that saved `stt.provider='xfyun-rtasr'` is passed to the factory.

- [ ] **Step 6: Run tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/main/modules/STTClientFactory.test.ts Test/main/mainEntry.test.ts --runInBand
```

Expected: pass.

## Task 6: Update Shared Config, Defaults, And Settings UI

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/constants.ts`
- Modify: `src/main/modules/config/ConfigStore.ts`
- Modify: `src/renderer/components/SettingsPanel/SettingsPanel.tsx`
- Test: `Test/shared/types.test.ts`
- Test: `Test/shared/constants.test.ts`
- Test: `Test/main/modules/config/ConfigStore.test.ts`
- Test: `Test/renderer/components/SettingsPanel.test.tsx`

- [ ] **Step 1: Write RED shared type/default tests**

In `Test/shared/types.test.ts`, add:

```ts
it('uses XFYun RTASR as the default realtime STT provider', () => {
  expect(DEFAULT_CONFIG.stt.provider).toBe('xfyun-rtasr');
});
```

In `Test/main/modules/config/ConfigStore.test.ts`, add a normalization test:

```ts
it('normalizes legacy xfyun provider to xfyun-rtasr for realtime captions', () => {
  writeSettings({
    ...DEFAULT_CONFIG,
    stt: {
      ...DEFAULT_CONFIG.stt,
      provider: 'xfyun',
    },
  });

  const loaded = store.load();

  expect(loaded.stt.provider).toBe('xfyun-rtasr');
});
```

Use the existing helper names in the test file. If helpers differ, adapt only the helper names, not the assertion.

- [ ] **Step 2: Run focused tests to verify RED**

Run:

```powershell
npm.cmd test -- Test/shared/types.test.ts Test/main/modules/config/ConfigStore.test.ts --runInBand
```

Expected: FAIL because `xfyun-rtasr` is not in the provider union/defaults.

- [ ] **Step 3: Update `STTConfig`**

In `src/shared/types.ts`, change:

```ts
provider: 'xfyun' | 'whisper-local' | 'whisper-api';
```

to:

```ts
provider: 'xfyun-rtasr' | 'xfyun-iat' | 'whisper-local' | 'whisper-api';
```

Change `DEFAULT_CONFIG.stt.provider` to `'xfyun-rtasr'`.

- [ ] **Step 4: Normalize legacy config**

In `src/main/modules/config/ConfigStore.ts`, normalize old provider values:

```ts
private normalizeSttConfig(stt: AppConfig['stt']): AppConfig['stt'] {
  return {
    ...stt,
    provider: stt.provider === ('xfyun' as AppConfig['stt']['provider'])
      ? 'xfyun-rtasr'
      : stt.provider,
  };
}
```

Call this from the same place existing translation/TMT normalization runs after loading/merging defaults.

- [ ] **Step 5: Update Settings UI**

In `src/renderer/components/SettingsPanel/SettingsPanel.tsx`:

- Add provider options:
  - `XFYun realtime transcription (RTASR recommended)` -> `xfyun-rtasr`
  - `XFYun short dictation fallback (IAT)` -> `xfyun-iat`
- Keep app id, api key, api secret, and language fields shared.
- Add helper text warning that IAT is fallback only for short dictation and can have unstable latency. Keep the text concise.
- Do not display or log secret values.

- [ ] **Step 6: Update SettingsPanel tests**

In `Test/renderer/components/SettingsPanel.test.tsx`, add assertions that:

- The recommended RTASR option is visible.
- Selecting RTASR saves `stt.provider='xfyun-rtasr'`.
- Selecting IAT saves `stt.provider='xfyun-iat'`.

- [ ] **Step 7: Run tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/shared/types.test.ts Test/shared/constants.test.ts Test/main/modules/config/ConfigStore.test.ts Test/renderer/components/SettingsPanel.test.tsx --runInBand
```

Expected: pass.

## Task 7: Preserve Partial Translation And Final-Only Sidecars

**Files:**
- Modify: `src/main/modules/session/SessionManager.ts`
- Test: `Test/main/modules/SessionManager.test.ts`
- Test: `Test/e2e/full-pipeline.test.ts`

- [ ] **Step 1: Add RED regression tests for RTASR partial/final flow**

In `Test/main/modules/SessionManager.test.ts`, add:

```ts
it('translates RTASR partials provisionally and keeps knowledge and notes final-only', async () => {
  jest.useFakeTimers();
  const session = manager.createSession('system');
  const partialCallback = jest.fn();
  manager.onSessionTranslatePartial(partialCallback);

  await manager.startSession(session);
  emitSTT('current speech', false, 'rtasr-1', {
    provider: 'xfyun-rtasr',
    stable: false,
  });

  jest.advanceTimersByTime(651);
  await Promise.resolve();

  expect(deps.translationGateway?.translateSentence).toHaveBeenCalledWith(
    expect.objectContaining({ sentenceId: 'rtasr-1', text: 'current speech', isFinal: false }),
    expect.objectContaining({ constraints: [] }),
  );
  expect(deps.constraintResolver?.resolve).not.toHaveBeenCalled();
  expect(deps.noteRepository?.appendSentence).not.toHaveBeenCalled();
});
```

Add a final regression:

```ts
it('uses final RTASR text as the authoritative sidecar input', async () => {
  const session = manager.createSession('system');
  await manager.startSession(session);

  emitSTT('final speech', true, 'rtasr-2', {
    provider: 'xfyun-rtasr',
    stable: true,
  });

  await Promise.resolve();

  expect(deps.constraintResolver?.resolve).toHaveBeenCalledWith('final speech');
  expect(deps.noteRepository?.appendSentence).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ text: 'final speech', isFinal: true }),
  );
});
```

- [ ] **Step 2: Run tests to verify RED or guard current behavior**

Run:

```powershell
npm.cmd test -- Test/main/modules/SessionManager.test.ts --runInBand
```

Expected: if current behavior already passes, keep these as guard tests. If it fails due metadata typing or timer behavior, fix only the flow needed for this task.

- [ ] **Step 3: Make minimal compatibility changes**

If needed, update `handleSTTResult` signature in `SessionManager`:

```ts
private handleSTTResult(
  text: string,
  isFinal: boolean,
  sentenceId: string,
  _metadata?: STTResultMetadata,
): void
```

Do not persist partial metadata unless a test requires it. The goal is provider compatibility without changing renderer payload shape in this phase.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/main/modules/SessionManager.test.ts Test/e2e/full-pipeline.test.ts --runInBand
```

Expected: pass.

## Task 8: Add Latency Metrics And Runtime Smoke Evidence Hooks

**Files:**
- Modify: `src/main/modules/stt/XfyunRtasrClient.ts`
- Modify: `src/main/modules/stt/XfyunIatClient.ts`
- Test: `Test/main/modules/XfyunRtasrClient.test.ts`
- Test: `Test/main/modules/XfyunIatClient.test.ts`

- [ ] **Step 1: Add RED latency threshold log tests**

In `Test/main/modules/XfyunRtasrClient.test.ts`, add:

```ts
it('logs first result latency with provider and target metadata', () => {
  jest.setSystemTime(new Date('2026-06-23T10:00:00.000Z'));
  const client = new XfyunRtasrClient();
  client.connect({ appId: 'test-app', apiKey: 'test-key', apiSecret: 'test-secret', language: 'en_us' });
  triggerEvent('open');
  client.sendAudio(new Int16Array([1, 2, 3, 4]));

  jest.setSystemTime(new Date('2026-06-23T10:00:01.500Z'));
  triggerEvent('message', JSON.stringify({ action: 'result', data: 'hello' }));

  expect(mockLogger.info).toHaveBeenCalledWith(
    'STT first result latency',
    expect.objectContaining({
      provider: 'xfyun-rtasr',
      firstResultLatencyMs: 1500,
      targetMs: 2000,
    }),
  );
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
npm.cmd test -- Test/main/modules/XfyunRtasrClient.test.ts --runInBand
```

Expected: FAIL until target metadata is logged.

- [ ] **Step 3: Implement metric fields**

Both IAT and RTASR should log:

```ts
this.l.info('STT first result latency', {
  provider: 'xfyun-rtasr',
  firstResultLatencyMs,
  targetMs: STT_CONSTANTS.FIRST_PARTIAL_TARGET_MS,
  audioFrames: this.audioFrameCount,
  totalMessages: this.messageCount,
});
```

IAT should use provider `xfyun-iat`.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```powershell
npm.cmd test -- Test/main/modules/XfyunRtasrClient.test.ts Test/main/modules/XfyunIatClient.test.ts --runInBand
```

Expected: pass.

## Task 9: Full Verification And Manual Realtime Smoke

**Files:**
- No production file edits unless verification reveals a bug.
- Update: `E:\Trae\CONTEXT\context-20260622-2204.md` with the final execution status.

- [ ] **Step 1: Run typecheck**

Run:

```powershell
npm.cmd run typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 2: Run focused STT/session/settings tests**

Run:

```powershell
npm.cmd test -- Test/main/modules/XfyunRtasrClient.test.ts Test/main/modules/XfyunIatClient.test.ts Test/main/modules/STTClientFactory.test.ts Test/main/modules/SessionManager.test.ts Test/main/modules/config/ConfigStore.test.ts Test/renderer/components/SettingsPanel.test.tsx Test/shared/types.test.ts Test/shared/constants.test.ts --runInBand
```

Expected: all pass.

- [ ] **Step 3: Run full Jest**

Run:

```powershell
npm.cmd test -- --runInBand
```

Expected: all suites pass. If unrelated existing failures appear, document exact failing tests and why they are unrelated.

- [ ] **Step 4: Run build**

Run:

```powershell
npm.cmd run build
```

Expected: build succeeds.

- [ ] **Step 5: Manual smoke with real RTASR credentials**

Run:

```powershell
npm.cmd run build
npm.cmd run preview
```

Then:

1. Open Settings.
2. Select `XFYun realtime transcription (RTASR recommended)`.
3. Enter XFYun STT AppID/API Key/API Secret without copying values into any report.
4. Keep Tencent TMT as realtime translation provider.
5. Start a system-audio session with a 30 second English clip.
6. Repeat at least 5 times if feasible.
7. Record metric summaries only:
   - first audio frame timestamp,
   - first STT partial latency,
   - first provisional translation latency if visible in logs,
   - final translation latency,
   - reconnect count,
   - dropped frame count,
   - whether final text is meaningful rather than `"."`.

Acceptance:

- First STT partial under 2s in the main smoke run.
- P95 first partial under 3s across repeated runs if 5 runs are available.
- First provisional translation under 1.2s after stable STT text.
- Final translation under 1.5s after final STT event.
- No NMT 404.
- No embedding response-shape error.
- No unreported reconnect/dropped-frame burst.

## Self-Review Checklist For Executor

- Every new production behavior has a focused Jest regression.
- RTASR is selected by default for realtime captions.
- IAT remains available as fallback and no longer sends Chinese-only `dwa` for English.
- Existing partial translation behavior still emits provisional `translate:partial`.
- Notes, knowledge retrieval, correction, recommendation, and summaries remain final-only.
- No secrets were written to docs, tests, logs, or prompts.
- The final report includes exact command results and manual smoke evidence, or explicitly says manual smoke could not run.

## Copy-Paste Prompt For Next Execution AI

You are taking over `E:\Trae\Project\七牛云\SynchroLens-new`.

Read first:

- `E:\Trae\CONTEXT\context-20260622-2204.md`
- `E:\Trae\Project\七牛云\SynchroLens-new\docs\superpowers\plans\2026-06-23-xfyun-rtasr-stt-refactor.md`
- `E:\Trae\Project\七牛云\SynchroLens-new\docs\specs\2026-06-22-realtime-stt-tmt-embedding-handoff.md`

Hard rules:

- Single agent only. Do not use subagents, delegation, or parallel agents.
- Do not modify `E:\Trae\Project\七牛云\SynchroLens`.
- Do not reset, stash, checkout, rebase, or revert unrelated existing changes.
- Do not copy secrets into code, docs, logs, tests, or final reports.
- Preserve final-only sidecars: notes, context memory, knowledge retrieval, correction, recommendation, and summary.

Goal:

Implement the cloud main STT path by adding XFYun RTASR / realtime-ASR behind a provider-neutral STT client abstraction. Keep the current XFYun IAT client only as fallback. Preserve the existing audio frame pacing and partial/final translation behavior.

Execute the plan task by task with TDD:

1. Extract provider-neutral STT types.
2. Move current IAT implementation into `XfyunIatClient` and gate `dwa` to Chinese only.
3. Add `XfyunRtasrClient` auth, WebSocket frame sending, close/reconnect metrics.
4. Add tolerant RTASR result parsing for partial/final/error envelopes.
5. Add `STTClientFactory` and select RTASR from config.
6. Update shared config defaults and Settings UI so RTASR is the recommended realtime provider.
7. Preserve provisional partial translation and final-only sidecars.
8. Add provider-specific latency metrics.
9. Run full verification and manual smoke if credentials/audio are available.

Required verification:

```powershell
cd E:\Trae\Project\七牛云\SynchroLens-new
npm.cmd run typecheck
npm.cmd test -- Test/main/modules/XfyunRtasrClient.test.ts Test/main/modules/XfyunIatClient.test.ts Test/main/modules/STTClientFactory.test.ts Test/main/modules/SessionManager.test.ts Test/main/modules/config/ConfigStore.test.ts Test/renderer/components/SettingsPanel.test.tsx Test/shared/types.test.ts Test/shared/constants.test.ts --runInBand
npm.cmd test -- --runInBand
npm.cmd run build
```

Report with:

- Blocking Findings
- Non-Blocking Findings
- Changes Made
- Command Results
- Manual Realtime Smoke Evidence
- Boundary Confirmation
- Decision: Ready / Not Ready

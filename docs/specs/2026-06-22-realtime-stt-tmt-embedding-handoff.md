# SynchroLens Realtime STT/TMT/Embedding Investigation Handoff

## Goal

Find the root causes of the current realtime failure, NMT/TMT confusion, NMT translation failure, and embedding failure in `E:\Trae\Project\七牛云\SynchroLens-new`, then hand a concrete execution plan to the next AI.

This document is investigation and execution handoff only. It intentionally does not modify business code.

## Hard Boundaries For The Execution AI

- Single agent only. Do not start subagents, delegate, or run parallel agent work.
- Do not modify the old tree `E:\Trae\Project\七牛云\SynchroLens`.
- Do not reset, stash, checkout, rebase, or revert unrelated existing changes.
- Do not put LLM enhancement, correction, or recommendation back into the realtime sentence translation main chain.
- Do not store or copy secrets into docs, logs, tests, or prompts.
- Main chain should remain bounded around realtime captions:
  `audio capture -> STT partial/final -> SessionManager -> TranslationGateway -> NMTTranslator -> Tencent TMT/local translate adapter -> translate events`.

## Executive Summary

There are four separate problems.

1. Realtime failure is structural. Audio is sent in 40 ms frames, but the current pipeline only translates `isFinal=true` STT results. In the fresh log, audio starts at `16:08:33`; the first STT partial arrives at `16:09:06` after 774 frames; translation does not start until stop/flush at `16:09:23`.
2. The current STT provider is XFYun IAT (`wss://iat-api.xfyun.cn/v2/iat`), which the official docs describe as a streaming dictation API for audio within 1 minute. For real meeting/video captions, XFYun RTASR or a mature streaming ASR architecture is a better fit.
3. NMT 404 is configuration drift. Persisted config has `translation.provider=deepseek` and `translation.apiEndpoint=https://api.deepseek.com`, while TMT credentials are saved separately. `NMTTranslator` appends `/translate`, so it calls `https://api.deepseek.com/translate`, which returns 404.
4. Embedding failure is response shape mismatch. `EmbeddingClient` calls Doubao `/embeddings/multimodal` but expects OpenAI-style `data: [{ index, embedding }]`. The observed response has `data.embedding`, and Volcengine's multimodal vectorization docs describe `data.embedding` as the vector field.

## Evidence

### Fresh Runtime Log

File: `E:\Trae\Project\七牛云\SynchroLens-new\logs\synchrolens-2026-06-22.log`

- `20602` - `16:08:30` session created.
- `20605` - `16:08:30` STT starts connecting with `language=en_us`.
- `20608` - `16:08:31` STT WebSocket connected.
- `20612` - `16:08:32` ffmpeg dshow-loopback audio capture started.
- `20617` - `16:08:33` first audio frame sent, `frameSize=640` Int16 samples, i.e. 1280 bytes / 40 ms.
- `20668` - `16:08:54` STT connection closed.
- `20675` - `16:08:57` STT WebSocket reconnected.
- `20700` - `16:09:06` first STT result, `isFinal=false`, `audioFrames=774`.
- `20712` - `16:09:11` second STT result, `isFinal=false`, `audioFrames=899`.
- `20737` - `16:09:20` third STT result, `isFinal=false`, `audioFrames=1137`.
- `20745` - `16:09:23` user sends `session:stop`.
- `20749` - `16:09:23` embedding starts only during stop/final handling.
- `20752` - `16:09:23` NMT translation starts only during stop/final handling.
- `20753-20754` - embedding fails because response format is not what `EmbeddingClient` expects.
- `20755` - NMT fails with `404 Not Found`.

### Source Facts

`src/main/modules/stt/STTClient.ts`

- Lines `217-239`: sends first XFYun IAT frame with `vad_eos: 1500` and `dwa: 'wpgs'`.
- Lines `263-284`: emits STT callbacks for partial and final.
- Lines `102-135`: sends audio frames only while WebSocket is open; dropped frames are counted but not buffered for replay.

`src/main/modules/session/SessionManager.ts`

- Lines `461-471`: all STT results go through `SentenceAssembler`.
- Lines `482-484`: every partial/final is emitted as transcript.
- Lines `486-489`: only `result.isFinal` enters the translation queue. This is the main product-level realtime blocker.
- Lines `525-540`: translation constraints, NMT call, final emit, and enhancement dispatch happen only inside the final translation queue.

`src/main/mainEntry.ts`

- Lines `472-479`: saved `translation.apiEndpoint` and `translation.model` are applied before provider-specific TMT override.
- Lines `480-484`: local TMT adapter starts only when saved `translation.provider === 'tencent-tmt'`.
- Lines `616-620`: runtime config update has the same provider-specific override pattern.

`src/main/modules/translate/NMTTranslator.ts`

- Lines `167-170`: `buildUrl()` appends `/translate` unless the endpoint already ends with `/translate`.
- With persisted `translation.apiEndpoint=https://api.deepseek.com`, the effective request is `https://api.deepseek.com/translate`, causing the observed 404.

`src/main/modules/vector/EmbeddingClient.ts`

- Lines `40-43`: Doubao/Volcengine path uses `/embeddings/multimodal` and sends multimodal `input`.
- Lines `60-66`: parser only accepts `data` as an array. This rejects the observed `{ data: { embedding: [...] } }` shape.

`src/renderer/components/SettingsPanel/SettingsPanel.tsx`

- Lines `164-175`: the visible group is still titled "NMT translation main chain"; endpoint/model are read-only; the test button says "Test NMT".
- Lines `176-185`: Tencent TMT credentials are in a separate group with no dedicated visible TMT test button.
- Lines `360-410`: the test implementation actually checks TMT `/health` and `/translate` when provider is `tencent-tmt`, so the UI label and mental model are behind the code.

Persisted config summary from `C:\Users\A\AppData\Roaming\synchrolens\SynchroLens\settings.json`:

- `translation.provider`: `deepseek`
- `translation.apiEndpoint`: `https://api.deepseek.com`
- `translation.model`: `deepseek-v4-flash`
- TMT SecretId exists and SecretKey is saved via secret storage, but this alone does not switch the translation provider.
- `vector.apiEndpoint`: `https://ark.cn-beijing.volces.com/api/v3`
- `vector.model`: `doubao-embedding-vision-251215`
- `stt.provider`: `xfyun`
- `stt.language`: `en_us`

No secret values should be copied from that file.

## External References Checked

- XFYun IAT WebAPI docs: the streaming dictation interface is for immediate speech-to-text within 1 minute, and can return results while audio uploads. The current doc names endpointing silence as `eos`, not `vad_eos`; dynamic correction can produce replacements rather than only appends, and the official doc says dynamic correction is Chinese-only. Source: https://www.xfyun.cn/doc/asr/voicedictation/API.html
- XFYun RTASR docs: the realtime ASR product is a long WebSocket connection for continuous audio streams and realtime text stream output. Source: https://www.xfyun.cn/doc/asr/rtasr/API.html
- XFYun realtime ASR large-model docs: recommend 16 kHz, 16 bit, mono PCM and 40 ms / 1280 byte audio frames. Source: https://www.xfyun.cn/doc/spark/asr_llm/rtasr_llm.html
- Whisper-Streaming: open-source realtime transcription/translation for long speech using LocalAgreement and self-adaptive latency; paper reports about 3.3 seconds latency on unsegmented long-form English ASR under their evaluation setup. Source: https://github.com/ufal/whisper_streaming and https://arxiv.org/html/2307.14743v2
- faster-whisper ecosystem: points to Whisper-Streaming and WhisperLive as realtime or near-live implementations built around faster-whisper. Source: https://github.com/SYSTRAN/faster-whisper
- Volcengine vectorization docs: `/embeddings/multimodal` returns the vector under `data.embedding`. Source: https://www.volcengine.com/docs/82379/1523520

## Root Cause Analysis

### 1. STT Is Not Actually Realtime Enough

The audio capture side is basically paced correctly. ffmpeg outputs 16 kHz mono s16le, and the app emits 40 ms frames matching the XFYun realtime guidance.

The latency appears after audio reaches STT:

- First sent frame: `16:08:33`.
- First STT partial: `16:09:06`.
- Gap: about 33 seconds.
- The STT WebSocket also closes once at `16:08:54` and reconnects at `16:08:57`.

The code has no first-partial latency watchdog, no close-code logging, and no replay/buffer strategy for audio lost during reconnect. Therefore the execution AI should not treat this as only "increase timeout" or only "change vad_eos".

Probable contributors:

- XFYun IAT is the wrong product shape for long continuous captioning. It is a streaming dictation interface for short audio within 1 minute. XFYun RTASR is built for continuous realtime transcription.
- The code sends `vad_eos: 1500`, while the current XFYun IAT WebAPI docs describe the endpointing silence parameter as `eos`. If the service ignores `vad_eos`, the intended endpointing tuning is not active.
- `dwa: 'wpgs'` is set unconditionally. XFYun docs say dynamic correction is Chinese-only, while the active language is `en_us`. This should be gated by language or removed for English.
- The current code does not log enough STT message metadata to know whether XFYun returned correction-style replacement ranges, close reason, endpointing state, or only delayed accumulated text.
- Reconnect drops audio frames while STT is not ready.

### 2. Translation Is Final-Only

Even if STT partials were fast, SynchroLens would still not be realtime translated captions because `SessionManager` queues translation only when `result.isFinal` is true.

This contradicts the architecture docs, which describe `STT -> TR: original text (partial/final)` and `translate:partial` as realtime streaming output.

For real realtime subtitles, the pipeline needs a provisional current-sentence path:

- STT partial updates should trigger debounced translation of stabilized text.
- Newer partials should cancel stale in-flight partial translations.
- Partial translations should be displayed as provisional and never written to notes/history/context.
- Final STT should perform one authoritative final translation, write notes, update context, and trigger sidecar enhancement.

### 3. NMT 404 Is Provider Drift, Not Tencent TMT Itself

The running config says DeepSeek, not Tencent TMT. The local TMT adapter only starts when `translation.provider` is `tencent-tmt`. Because the provider stayed `deepseek`, `NMTTranslator` used DeepSeek as if it were a local `/translate` adapter.

Direct result:

`https://api.deepseek.com` + `/translate` -> `404 Not Found`

The UI made this easy to produce:

- It shows an "NMT main chain" block with read-only endpoint/model.
- It shows a separate Tencent TMT config block underneath.
- Users can fill TMT credentials and still leave the provider on DeepSeek or another stale value.
- The TMT connection test exists in code but is labeled as NMT and is located in the wrong mental area.

### 4. Embedding Failure Is A Parser Bug

Current code assumes all embedding providers return OpenAI-style:

```json
{
  "data": [
    { "index": 0, "embedding": [0.1, 0.2] }
  ]
}
```

The observed Doubao multimodal response is shaped like:

```json
{
  "data": {
    "embedding": [0.1, 0.2]
  }
}
```

The execution fix should support both shapes, and it should keep knowledge retrieval as a sidecar that degrades to no constraints on failure.

## Recommended Product/Architecture Direction

### Minimum Fix To Stop The Demo From Failing

1. Migrate current persisted translation config so Tencent TMT credentials imply `translation.provider='tencent-tmt'`, endpoint `http://127.0.0.1:8765`, and model `tencent-tmt`, unless the user explicitly selects custom NMT.
2. Rename and reorganize Settings UI so Tencent TMT is clearly the realtime translation main provider.
3. Add a dedicated Tencent TMT test button in the TMT config group.
4. Fix Doubao embedding parser for `data.embedding`.
5. Add STT latency instrumentation and log WebSocket close code/reason.

This makes the app understandable and removes NMT 404 / embedding parser failures, but it does not fully solve realtime latency.

### Real Fix For "Truly Realtime"

1. Replace or supplement XFYun IAT with a provider meant for continuous realtime:
   - Preferred cloud path: XFYun RTASR or XFYun realtime ASR large-model WebSocket.
   - Local/open-source path: Whisper-Streaming or WhisperLiveKit/faster-whisper with VAD and LocalAgreement-style stabilization.
2. Implement partial translation:
   - Use a `RealtimePartialTranslator` or equivalent logic in `SessionManager`.
   - Debounce partial updates, e.g. 500-800 ms or text delta >= 8 characters.
   - Abort stale in-flight partial translation when a newer partial arrives.
   - Emit provisional `translate:partial`.
   - Never commit provisional text to notes, context window, personal dictionary, or enhancement sidecars.
   - On final STT, run final translation and freeze.
3. Use VAD/endpointing and stabilization:
   - VAD decides utterance boundaries.
   - LocalAgreement or similar stabilization decides what prefix is safe to display/translate.
   - For TMT, which is request/response rather than token streaming, translate stabilized chunks frequently rather than waiting for a long final sentence.

Target acceptance thresholds:

- Audio frame emission remains 40 ms / 1280 bytes.
- First STT partial visible within 2 seconds on a 15-30 second English test clip.
- First provisional translation visible within 1.2 seconds after a stabilized STT partial.
- Final translation appears within 1.5 seconds after STT endpoint/final.
- No `NMT ... 404 Not Found` during Tencent TMT path.
- No `Embedding API 返回格式异常` for Doubao multimodal response.

## Execution Plan

### Task 1 - Add Observability Before Changing Behavior

Files:

- Modify: `src/main/modules/stt/STTClient.ts`
- Modify: `src/main/modules/session/SessionManager.ts`
- Test: `Test/main/modules/STTClient.test.ts`
- Test: `Test/main/modules/SessionManager.test.ts`

Steps:

1. Add STT metrics fields: connection start time, first audio frame time, first STT result time, last close code/reason.
2. In `STTClient.sendAudio()`, record the first audio send timestamp and frame count.
3. In `STTClient.handleMessage()`, when the first result arrives, log `firstPartialLatencyMs`.
4. In the WebSocket `close` handler, log close `code` and `reason`.
5. Add tests that simulate first audio frame, then first message, and assert the latency log metadata is present.
6. Add a test for close handler metadata.

Expected result:

- Logs can distinguish audio capture delay, STT server delay, reconnect delay, and final-only pipeline delay.

### Task 2 - Fix TMT Provider Drift And Settings UI

Files:

- Modify: `src/renderer/components/SettingsPanel/SettingsPanel.tsx`
- Modify: `src/main/modules/config/ConfigStore.ts`
- Modify: `src/main/mainEntry.ts`
- Test: `Test/renderer/components/SettingsPanel.test.tsx`
- Test: `Test/main/modules/config/ConfigStore.test.ts`
- Test: `Test/main/mainEntry.test.ts`
- Test: `Test/renderer/windows/main/MainWindow.test.tsx`

Steps:

1. Add config normalization after load:
   - If `translation.tencent.secretId` or `translation.tencent.secretKeySaved` exists and no explicit custom-NMT marker exists, set `translation.provider='tencent-tmt'`.
   - Set `translation.apiEndpoint='http://127.0.0.1:8765'`.
   - Set `translation.model='tencent-tmt'`.
2. In `mainEntry`, apply provider-specific endpoint/model before generic saved endpoint/model, or skip generic endpoint/model when provider is `tencent-tmt`.
3. Rename the settings group from "NMT translation main chain" to "Realtime translation provider" or "Tencent TMT realtime translation".
4. Remove read-only NMT endpoint/model rows while provider is TMT. If custom NMT remains supported, show endpoint/model only when provider is custom NMT.
5. Move/add the test button into the Tencent TMT group with user-facing label "Test Tencent TMT".
6. Ensure the test still calls `/health` before `/translate`.
7. Add/adjust tests so they no longer assert the old "Test NMT" UX for the TMT path.

Expected result:

- Filling TMT credentials and saving cannot leave the realtime main chain on DeepSeek by accident.
- UI says what the system actually does.
- The adapter starts when TMT is selected.

### Task 3 - Fix Doubao Embedding Parser

Files:

- Modify: `src/main/modules/vector/EmbeddingClient.ts`
- Test: create or modify `Test/main/modules/EmbeddingClient.test.ts`
- Optional: adjust `Test/main/modules/PersonalizationResolver.test.ts` if it currently mocks only array-shaped embeddings.

Steps:

1. Introduce a parser function:
   - Accept OpenAI style: `data: [{ index, embedding }]`.
   - Accept Doubao multimodal style: `data: { embedding: [...] }`.
   - Accept single text fallback only when one input text was sent.
   - Validate every embedding item is a numeric array.
2. Preserve provider-specific endpoint selection:
   - `/embeddings/multimodal` for Doubao vision/multimodal models.
   - `/embeddings` for OpenAI-compatible text embedding models.
3. Add tests:
   - OpenAI array response returns embeddings in index order.
   - Doubao multimodal object response returns one embedding.
   - Malformed response throws a useful error but does not crash callers that already degrade sidecar constraints.

Expected result:

- Knowledge retrieval no longer fails just because Doubao multimodal uses object-shaped `data`.

### Task 4 - Implement Provisional Partial Translation

Files:

- Modify: `src/main/modules/session/SessionManager.ts`
- Optional create: `src/main/modules/session/RealtimePartialTranslator.ts`
- Modify: `src/shared/types.ts` if the renderer needs an explicit `provisional?: boolean` flag.
- Modify renderer hooks/windows only if current UI cannot distinguish provisional/final.
- Test: `Test/main/modules/SessionManager.test.ts`
- Test: `Test/e2e/full-pipeline.test.ts`
- Test renderer subtitle tests if UI changes.

Steps:

1. Keep current final queue for authoritative final translations.
2. Add a separate current-partial path:
   - Only process `result.isFinal === false`.
   - Ignore empty text and unchanged text.
   - Debounce, e.g. 500-800 ms.
   - Abort older partial translation when a newer partial arrives.
   - Call `translationGateway.translateSentence()` with `constraints=[]` for partials.
   - Emit `translate:partial` only.
   - Do not push partial results into `activeSession.session.sentences`.
   - Do not write partials to notes.
   - Do not call `dispatchPostTranslationEnhancements()`.
3. On final result:
   - Abort pending partial translation for the same sentence.
   - Translate final text through the existing queue.
   - Write note and remember context only for final.
4. Add tests:
   - Partial STT emits transcript and provisional translate partial.
   - Partial STT does not append note and does not emit final translation.
   - A newer partial aborts older in-flight translation.
   - Final STT aborts partial and emits final translation.
   - Knowledge retrieval is called for final only, not partial.

Expected result:

- The subtitle can show translated current speech before STT final.
- Existing notes/history/enhancement behavior remains final-only.

### Task 5 - Move STT To A Continuous Realtime Backend

Files depend on the chosen provider.

Cloud option files:

- Modify/create: `src/main/modules/stt/STTClient.ts` or `src/main/modules/stt/XfyunRtasrClient.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/renderer/components/SettingsPanel/SettingsPanel.tsx`
- Test: `Test/main/modules/STTClient.test.ts` or new `XfyunRtasrClient.test.ts`

Open-source local option files:

- Create adapter around a local WebSocket service such as WhisperLiveKit/Whisper-Streaming.
- Keep the same app-side `ISTTClient` contract: `connect`, `sendAudio`, `onResult`, `onError`, `onClose`, `onStateChange`.

Steps:

1. Add a provider enum that distinguishes short IAT from continuous RTASR/local streaming.
2. Keep XFYun IAT as fallback if desired, but do not present it as the best realtime default.
3. For XFYun IAT fallback:
   - Gate `dwa: 'wpgs'` to Chinese only.
   - Replace or verify `vad_eos` against the current documented `eos` parameter.
   - Expose or tune endpointing options.
   - Log 1-minute session cap risk.
4. For RTASR/local streaming:
   - Use continuous WebSocket semantics.
   - Preserve 16 kHz, 16 bit, mono PCM.
   - Use the provider's expected frame size; XFYun realtime ASR large-model docs recommend 40 ms / 1280 bytes.
5. Add tests for:
   - Provider-specific first frame/business params.
   - Partial message parsing.
   - Reconnect/close metadata.
   - Language-specific dynamic-correction gating.

Expected result:

- STT first partial latency is no longer 30 seconds on continuous English input.

## Suggested Verification Commands

Run from `E:\Trae\Project\七牛云\SynchroLens-new`:

```powershell
npm.cmd run typecheck
npm.cmd test -- Test/main/modules/STTClient.test.ts Test/main/modules/SessionManager.test.ts Test/main/modules/NMTTranslator.test.ts Test/main/modules/tmt/TencentTMTAdapterServer.test.ts Test/main/modules/tmt/TencentTMTClient.test.ts Test/main/modules/config/ConfigStore.test.ts Test/renderer/components/SettingsPanel.test.tsx Test/renderer/windows/main/MainWindow.test.tsx --runInBand
npm.cmd test -- --runInBand
npm.cmd run build
```

Manual smoke test:

1. Start with formal path:

```powershell
npm.cmd run build
npm.cmd run preview
```

2. Open Settings.
3. Confirm Tencent TMT is visibly the realtime translation provider.
4. Fill TMT config without exposing secrets in logs/docs.
5. Click the dedicated TMT test button.
6. Start a system-audio session with a 30 second English speech clip.
7. Confirm logs show:
   - first audio frame time,
   - first STT partial latency,
   - first provisional translation latency,
   - final translation latency.
8. Confirm no NMT 404 and no embedding response-shape error.

## Copy-Paste Prompt For Next Execution AI

You are taking over `E:\Trae\Project\七牛云\SynchroLens-new`.

Read first:

- `E:\Trae\CONTEXT\context-20260622-1647.md`
- `E:\Trae\Project\七牛云\SynchroLens-new\docs\specs\2026-06-22-realtime-stt-tmt-embedding-handoff.md`

Hard rules:

- Single agent only. Do not use subagents, delegation, or parallel agents.
- Do not modify `E:\Trae\Project\七牛云\SynchroLens`.
- Do not reset/stash/checkout/rebase.
- Do not copy secrets.
- Preserve the final-only sidecar boundary for notes, context memory, knowledge retrieval, correction, recommendation, and summary.

Implement in this order:

1. Add observability for STT first audio, first result, close code/reason, and latency.
2. Fix TMT provider drift and Settings UI so Tencent TMT is the clear realtime translation provider with a dedicated test button.
3. Fix Doubao multimodal embedding parser.
4. Implement provisional partial translation without committing partials to notes/history/enhancement.
5. Move STT from short IAT semantics toward continuous RTASR/local streaming, or at minimum gate IAT dynamic correction to Chinese and document/measure the remaining latency limit.

Required verification:

```powershell
cd E:\Trae\Project\七牛云\SynchroLens-new
npm.cmd run typecheck
npm.cmd test -- Test/main/modules/STTClient.test.ts Test/main/modules/SessionManager.test.ts Test/main/modules/NMTTranslator.test.ts Test/main/modules/tmt/TencentTMTAdapterServer.test.ts Test/main/modules/tmt/TencentTMTClient.test.ts Test/main/modules/config/ConfigStore.test.ts Test/renderer/components/SettingsPanel.test.tsx Test/renderer/windows/main/MainWindow.test.tsx --runInBand
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

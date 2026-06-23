import { NMTTranslator } from '../../../src/main/modules/translate/NMTTranslator';
import type { TranslationConstraint, TranslationPair } from '../../../src/shared/types';

function createJsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(ok ? '' : 'upstream error'),
    body: null,
  } as unknown as Response;
}

function pair(original: string, translation: string): TranslationPair {
  return {
    sentenceId: `sent-${original}`,
    original,
    translation,
  };
}

describe('NMTTranslator', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('posts the sentence and minimal context to the NMT translate endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createJsonResponse({ translation: '你好世界' }),
    ) as typeof global.fetch;

    const translator = new NMTTranslator({
      apiEndpoint: 'https://nmt.example.com',
      apiKey: 'nmt-key',
      model: 'nmt-general',
      targetLanguage: 'zh-CN',
    });

    const chunks: string[] = [];
    for await (const chunk of translator.translate('Hello world', [pair('Previous', '上一句')])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['你好世界']);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://nmt.example.com/translate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer nmt-key',
        }),
      }),
    );

    const request = (global.fetch as jest.Mock).mock.calls[0]?.[1] as { body: string };
    const body = JSON.parse(request.body);
    expect(body).toEqual({
      text: 'Hello world',
      targetLanguage: 'zh-CN',
      model: 'nmt-general',
      context: [pair('Previous', '上一句')],
    });
  });

  it('applies only language and domain term constraints locally without sending them upstream', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createJsonResponse({ translation: 'The apple service has latency' }),
    ) as typeof global.fetch;

    const translator = new NMTTranslator({
      apiEndpoint: 'https://nmt.example.com',
      targetLanguage: 'zh-CN',
    });
    const constraints: TranslationConstraint[] = [
      {
        source: 'latency',
        target: '时延',
        sourceType: 'domain',
        priority: 2,
        matchType: 'exact',
        enforceMode: 'term',
      },
      {
        source: 'apple',
        target: '苹果',
        sourceType: 'language',
        priority: 1,
        matchType: 'exact',
        enforceMode: 'term',
      },
      {
        source: 'service',
        target: '我个人想要的整句翻译',
        sourceType: 'personal',
        priority: 3,
        matchType: 'exact',
        enforceMode: 'sentence',
        entryId: 'p1',
      },
    ];

    const chunks: string[] = [];
    for await (const chunk of translator.translate('apple service latency', [], constraints)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['The 苹果 service has 时延']);
    const request = (global.fetch as jest.Mock).mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(request.body)).toEqual({
      text: 'apple service latency',
      targetLanguage: 'zh-CN',
      model: 'nmt-default',
      context: [],
    });
  });

  it('accepts an endpoint that already targets /translate and reads nested translation text', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createJsonResponse({ data: { translation: '测试通过' } }),
    ) as typeof global.fetch;

    const translator = new NMTTranslator({
      apiEndpoint: 'https://nmt.example.com/custom/translate',
      targetLanguage: 'zh-CN',
    });

    const chunks: string[] = [];
    for await (const chunk of translator.translate('Test', [])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['测试通过']);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://nmt.example.com/custom/translate',
      expect.any(Object),
    );
  });

  it('throws when the upstream response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createJsonResponse({}, false, 503),
    ) as typeof global.fetch;

    const translator = new NMTTranslator({
      apiEndpoint: 'https://nmt.example.com',
      targetLanguage: 'zh-CN',
    });

    await expect(async () => {
      for await (const _chunk of translator.translate('Hello', [])) {
        // consume
      }
    }).rejects.toThrow('NMT 翻译失败');
  });

  it('keeps using the local /translate adapter contract for tencent-tmt model', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      createJsonResponse({ translation: '你好' }),
    ) as typeof global.fetch;

    const translator = new NMTTranslator({
      apiEndpoint: 'http://127.0.0.1:8765',
      model: 'tencent-tmt',
      targetLanguage: 'zh-CN',
    });

    const chunks: string[] = [];
    for await (const chunk of translator.translate('Hello', [pair('Previous', '上一句')])) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['你好']);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8765/translate',
      expect.objectContaining({
        body: JSON.stringify({
          text: 'Hello',
          targetLanguage: 'zh-CN',
          model: 'tencent-tmt',
          context: [pair('Previous', '上一句')],
        }),
      }),
    );
  });
});

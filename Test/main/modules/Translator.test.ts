/**
 * Translator DeepSeek 流式翻译客户端单元测试
 * 测试流式翻译、上下文窗口、摘要生成、错误处理
 */

import { Translator } from '../../../src/main/modules/translate/Translator';
import type { TranslationPair, TranslationResult } from '../../../src/shared/types';

/** 创建模拟 SSE 数据流响应 */
function createMockStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let chunkIndex = 0;

  const stream = new ReadableStream({
    pull(controller) {
      if (chunkIndex < chunks.length) {
        controller.enqueue(encoder.encode(chunks[chunkIndex]));
        chunkIndex++;
      } else {
        controller.close();
      }
    },
  });

  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: stream,
    text: jest.fn(),
    json: jest.fn(),
  } as unknown as Response;
}

/** 创建模拟 JSON 响应 */
function createMockJsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(ok ? '' : 'error body'),
    body: null,
  } as unknown as Response;
}

/** 创建翻译对 */
function pair(original: string, translation: string): TranslationPair {
  return { sentenceId: `sent-${original}`, original, translation };
}

describe('Translator DeepSeek 流式翻译客户端', () => {
  let translator: Translator;
  let originalFetch: typeof global.fetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  beforeEach(() => {
    translator = new Translator({ apiKey: 'test-key' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('translate 流式翻译', () => {
    it('应该逐 token 流式返回翻译结果', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        createMockStreamResponse([
          'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"世界"}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      ) as any;

      const tokens: string[] = [];
      for await (const token of translator.translate('Hello World', [])) {
        tokens.push(token);
      }

      expect(tokens).toEqual(['你好', '世界']);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('应该将上下文翻译对传入 API 请求', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        createMockStreamResponse(['data: [DONE]\n\n']),
      ) as any;

      const context = [pair('First', '第一'), pair('Second', '第二')];

      for await (const token of translator.translate('Third', context)) {
        // consume
      }

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const messages = body.messages as { role: string; content: string }[];

      // 应该有 system prompt + context + user message
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages[0].role).toBe('system');

      // 用户消息应包含待翻译文本
      const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.content);
      const lastUserMsg = userMessages[userMessages.length - 1];
      expect(lastUserMsg).toContain('Third');
    });

    it('应该设置 stream: true 和 temperature 参数', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        createMockStreamResponse(['data: [DONE]\n\n']),
      ) as any;

      for await (const token of translator.translate('Hello', [])) {
        // consume
      }

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.stream).toBe(true);
      expect(body.temperature).toBeDefined();
    });

    it('应该在 API 返回非 200 时抛出错误', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        createMockJsonResponse({}, false, 401),
      ) as any;

      await expect(async () => {
        for await (const token of translator.translate('Hello', [])) {
          // consume
        }
      }).rejects.toThrow('DeepSeek API 错误');
    });

    it('应该在超时时抛出异常', async () => {
      global.fetch = jest.fn().mockRejectedValue(
        new DOMException('The operation was aborted', 'AbortError'),
      ) as any;

      await expect(async () => {
        for await (const token of translator.translate('Hello', [])) {
          // consume
        }
      }).rejects.toThrow();
    });
  });

  describe('buildContextWindow 上下文窗口构建', () => {
    it('应该从翻译对列表构建上下文字符串', () => {
      const context = [
        pair('Hello', '你好'),
        pair('World', '世界'),
      ];

      const result = translator.buildContextWindow(context, 5);

      expect(result).toContain('Hello');
      expect(result).toContain('你好');
      expect(result).toContain('World');
      expect(result).toContain('世界');
      expect(result).toContain('---');
    });

    it('应该在翻译对为空时返回空字符串', () => {
      const result = translator.buildContextWindow([], 5);
      expect(result).toBe('');
    });

    it('应该在翻译对数量超过 maxCount 时只保留最近 N 句', () => {
      const context = [
        pair('A', '1'),
        pair('B', '2'),
        pair('C', '3'),
        pair('D', '4'),
        pair('E', '5'),
        pair('F', '6'),
      ];

      const result = translator.buildContextWindow(context, 3);

      // 应该只包含最近的 3 句（D/E/F）
      expect(result).toContain('D');
      expect(result).toContain('E');
      expect(result).toContain('F');
      expect(result).not.toContain('A');
      expect(result).not.toContain('B');
      expect(result).not.toContain('C');
    });

    it('应该在翻译对数量不足时使用全部', () => {
      const context = [pair('Only', '唯一')];

      const result = translator.buildContextWindow(context, 5);

      expect(result).toContain('Only');
      expect(result).toContain('唯一');
    });
  });

  describe('translateFull 非流式翻译', () => {
    it('应该返回完整翻译结果', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        createMockJsonResponse({
          choices: [{ message: { content: '你好世界' } }],
        }),
      ) as any;

      const result = await translator.translateFull('Hello World', []);

      expect(result).toBe('你好世界');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // 验证 stream 为 false
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.stream).toBe(false);
    });

    it('应该在 API 返回错误时抛出异常', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        createMockJsonResponse({}, false, 500),
      ) as any;

      await expect(
        translator.translateFull('Hello', []),
      ).rejects.toThrow('DeepSeek API 错误');
    });
  });

  describe('generateSummary 摘要生成', () => {
    it('应该返回摘要文本', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        createMockJsonResponse({
          choices: [{ message: { content: '会议讨论了项目进度和新功能开发。' } }],
        }),
      ) as any;

      const sentences: TranslationResult[] = [
        {
          sentenceId: 's1',
          original: 'We discussed the timeline.',
          translation: '我们讨论了时间线。',
          isFinal: true,
          corrections: [],
        },
      ];

      const summary = await translator.generateSummary(sentences);

      expect(summary).toContain('项目进度');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // 验证 temperature 为 0.5
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.temperature).toBe(0.5);
    });

    it('应该在调用时传入句子内容', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        createMockJsonResponse({
          choices: [{ message: { content: 'Summary' } }],
        }),
      ) as any;

      const sentences: TranslationResult[] = [
        {
          sentenceId: 's1',
          original: 'Hello',
          translation: '你好',
          isFinal: true,
          corrections: [],
        },
      ];

      await translator.generateSummary(sentences);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      const userContent = body.messages[1].content as string;

      expect(userContent).toContain('Hello');
      expect(userContent).toContain('你好');
    });
  });

  describe('API 端点自定义配置', () => {
    it('应该支持自定义 API 端点和模型', async () => {
      const customTranslator = new Translator({
        apiKey: 'custom-key',
        apiEndpoint: 'https://custom.api.com/v1',
        model: 'custom-model',
      });

      global.fetch = jest.fn().mockResolvedValue(
        createMockStreamResponse(['data: [DONE]\n\n']),
      ) as any;

      for await (const token of customTranslator.translate('test', [])) {
        // consume
      }

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toContain('https://custom.api.com/v1');
      const body = JSON.parse(fetchCall[1].body);
      expect(body.model).toBe('custom-model');
    });
  });
});

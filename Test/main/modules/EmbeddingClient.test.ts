/**
 * EmbeddingClient 单元测试
 * 覆盖 Doubao 与 OpenAI 风格 embedding 返回结构
 */

import { EmbeddingClient } from '../../../src/main/modules/vector/EmbeddingClient';

describe('EmbeddingClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('parses OpenAI-style array embedding payloads in index order', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [
          { index: 1, embedding: [3, 4] },
          { index: 0, embedding: [1, 2] },
        ],
      }),
    });

    const client = new EmbeddingClient({
      apiKey: 'test-key',
      apiEndpoint: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small',
    });

    await expect(client.embedTexts(['a', 'b'])).resolves.toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('parses Doubao single-input object embedding payloads', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          embedding: [0.11, 0.22, 0.33],
        },
      }),
    });

    const client = new EmbeddingClient({
      apiKey: 'test-key',
      apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
      model: 'doubao-embedding-vision-251215',
    });

    await expect(client.embedTexts(['ping'])).resolves.toEqual([
      [0.11, 0.22, 0.33],
    ]);
  });

  it('throws when embedding payload shape is malformed', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          embedding: 'invalid',
        },
      }),
    });

    const client = new EmbeddingClient({
      apiKey: 'test-key',
      apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
      model: 'doubao-embedding-vision-251215',
    });

    await expect(client.embedTexts(['ping'])).rejects.toThrow('Embedding API 返回格式异常');
  });

  it('throws when array embedding entries are malformed', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: [
          { index: 0, embedding: [1, 2] },
          { index: 1, embedding: ['bad', 4] },
        ],
      }),
    });

    const client = new EmbeddingClient({
      apiKey: 'test-key',
      apiEndpoint: 'https://api.openai.com/v1',
      model: 'text-embedding-3-small',
    });

    await expect(client.embedTexts(['a', 'b'])).rejects.toThrow('Embedding API 返回格式异常');
  });
});

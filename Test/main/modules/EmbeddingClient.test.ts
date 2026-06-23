import { EmbeddingClient } from '../../../src/main/modules/vector/EmbeddingClient';

function createJsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  } as unknown as Response;
}

describe('EmbeddingClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('parses OpenAI-style array embedding responses in index order', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createJsonResponse({
        data: [
          { index: 1, embedding: [0.3, 0.4] },
          { index: 0, embedding: [0.1, 0.2] },
        ],
      }),
    );

    const client = new EmbeddingClient({
      apiKey: 'key',
      apiEndpoint: 'https://api.openai.example/v1',
      model: 'text-embedding',
    });

    await expect(client.embedTexts(['first', 'second'])).resolves.toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it('parses Doubao multimodal object embedding responses for a single text input', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createJsonResponse({
        data: {
          embedding: [0.5, 0.6, 0.7],
        },
      }),
    );

    const client = new EmbeddingClient({
      apiKey: 'key',
      apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
      model: 'doubao-embedding-vision-251215',
    });

    await expect(client.embedText('latency')).resolves.toEqual([0.5, 0.6, 0.7]);
  });

  it('rejects malformed embedding payloads with a useful parser error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      createJsonResponse({
        data: {
          embedding: ['not-a-number'],
        },
      }),
    );

    const client = new EmbeddingClient({
      apiKey: 'key',
      apiEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
      model: 'doubao-embedding-vision-251215',
    });

    await expect(client.embedText('latency')).rejects.toThrow('Embedding API');
  });
});

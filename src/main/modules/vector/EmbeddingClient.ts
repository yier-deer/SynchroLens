import { createLogger } from '../../utils/logger';

interface EmbeddingConfig {
  apiKey: string;
  apiEndpoint?: string;
  model?: string;
}

type EmbeddingApiResponse = {
  data?: Array<{ index?: number; embedding?: unknown }> | { embedding?: unknown };
};

function isNumericArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function parseEmbeddingResponse(payload: EmbeddingApiResponse, inputCount: number): number[][] {
  if (Array.isArray(payload.data)) {
    const sorted = payload.data
      .map((item, fallbackIndex) => ({
        index: typeof item.index === 'number' ? item.index : fallbackIndex,
        embedding: item.embedding,
      }))
      .sort((a, b) => a.index - b.index);

    const embeddings = sorted.map((item) => item.embedding);
    if (embeddings.length !== inputCount || !embeddings.every(isNumericArray)) {
      throw new Error('Embedding API 返回格式异常');
    }

    return embeddings;
  }

  if (payload.data && !Array.isArray(payload.data) && inputCount === 1 && isNumericArray(payload.data.embedding)) {
    return [payload.data.embedding];
  }

  throw new Error('Embedding API 返回格式异常');
}

export class EmbeddingClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private l = createLogger('EmbeddingClient');

  constructor(config: EmbeddingConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.apiEndpoint || 'https://ark.cn-beijing.volces.com/api/v3';
    this.model = config.model || 'doubao-embedding-vision-251215';
  }

  setApiKey(key: string): void { this.apiKey = key; }
  setModel(model: string): void { this.model = model; }
  setApiEndpoint(endpoint: string): void { this.baseUrl = endpoint; }
  get hasApiKey(): boolean { return !!this.apiKey; }

  private get isDoubao(): boolean {
    return this.baseUrl.includes('volces.com') || this.baseUrl.includes('volcengine');
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    this.l.info('开始向量化', { count: texts.length, model: this.model, provider: this.isDoubao ? 'doubao' : 'openai' });

    const endpointPath = this.isDoubao ? '/embeddings/multimodal' : '/embeddings';
    const requestBody = this.isDoubao
      ? { model: this.model, input: texts.map((text) => ({ type: 'text' as const, text })) }
      : { model: this.model, input: texts };

    try {
      const response = await fetch(`${this.baseUrl}${endpointPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        this.l.error('Embedding API 请求失败', { status: response.status, body: errorBody.substring(0, 200) });
        throw new Error(`Embedding API 错误: ${response.status} - ${errorBody.substring(0, 100)}`);
      }

      const data = await response.json() as EmbeddingApiResponse;
      let embeddings: number[][];
      try {
        embeddings = parseEmbeddingResponse(data, texts.length);
      } catch (error) {
        this.l.error('Embedding API 返回格式异常', { response: JSON.stringify(data).substring(0, 200) });
        throw error;
      }

      this.l.info('向量化完成', { count: embeddings.length });
      return embeddings;
    } catch (err) {
      this.l.error('向量化失败', { error: (err as Error).message });
      throw err;
    }
  }

  async embedText(text: string): Promise<number[]> {
    const results = await this.embedTexts([text]);
    return results[0];
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

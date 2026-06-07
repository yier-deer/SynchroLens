/**
 * DeepSeek Embedding API 客户端
 * 负责调用 DeepSeek Embeddings API 进行文本向量化
 */

import { createLogger } from '../../utils/logger';

interface EmbeddingConfig {
  apiKey: string;
  apiEndpoint?: string;
  model?: string;
}

export class EmbeddingClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private l = createLogger('EmbeddingClient');

  constructor(config: EmbeddingConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.apiEndpoint || 'https://api.deepseek.com';
    this.model = config.model || 'deepseek-embedding';
  }

  setApiKey(key: string): void { this.apiKey = key; }
  setModel(model: string): void { this.model = model; }
  setApiEndpoint(endpoint: string): void { this.baseUrl = endpoint; }

  /** 批量文本向量化 */
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    this.l.info('开始向量化', { count: texts.length });
    try {
      const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: this.model, input: texts }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const eb = await response.text().catch(() => '');
        throw new Error(`Embedding API 错误: ${response.status} — ${eb}`);
      }
      const data = await response.json() as { data: Array<{ index: number; embedding: number[] }> };
      return data.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
    } catch (err) {
      this.l.error('向量化失败', { error: (err as Error).message });
      throw err;
    }
  }

  /** 单条文本向量化 */
  async embedText(text: string): Promise<number[]> {
    const results = await this.embedTexts([text]);
    return results[0];
  }
}

/** 余弦相似度 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

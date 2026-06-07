/**
 * Embedding 向量化客户端
 * 支持豆包（火山引擎）多模态 Embedding API，兼容其他 OpenAI 格式提供方
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
    this.baseUrl = config.apiEndpoint || 'https://ark.cn-beijing.volces.com/api/v3';
    this.model = config.model || 'doubao-embedding-vision-251215';
  }

  setApiKey(key: string): void { this.apiKey = key; }
  setModel(model: string): void { this.model = model; }
  setApiEndpoint(endpoint: string): void { this.baseUrl = endpoint; }
  get hasApiKey(): boolean { return !!this.apiKey; }

  /** 检测是否是豆包/火山引擎端点 */
  private get isDoubao(): boolean {
    return this.baseUrl.includes('volces.com') || this.baseUrl.includes('volcengine');
  }

  /** 批量文本向量化 */
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    this.l.info('开始向量化', { count: texts.length, model: this.model, provider: this.isDoubao ? 'doubao' : 'openai' });

    const endpointPath = this.isDoubao ? '/embeddings/multimodal' : '/embeddings';
    const requestBody = this.isDoubao
      ? { model: this.model, input: texts.map(t => ({ type: 'text' as const, text: t })) }
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
        const eb = await response.text().catch(() => '');
        this.l.error('Embedding API 请求失败', { status: response.status, body: eb.substring(0, 200) });
        throw new Error(`Embedding API 错误: ${response.status} — ${eb.substring(0, 100)}`);
      }
      const data = await response.json() as { data: Array<{ index: number; embedding: number[] }> };
      if (!data.data || !Array.isArray(data.data)) {
        this.l.error('Embedding API 返回格式异常', { response: JSON.stringify(data).substring(0, 200) });
        throw new Error('Embedding API 返回格式异常');
      }
      this.l.info('向量化完成', { count: data.data.length });
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

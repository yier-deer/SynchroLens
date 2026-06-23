/**
 * DeepSeek 流式翻译客户端
 * 负责调用 DeepSeek V4 Pro API 进行实时翻译，支持上下文窗口和纠正
 */

import { TRANSLATE_CONSTANTS } from '../../../shared/constants';
import type { Correction, TranslationResult, TranslationPair } from '../../../shared/types';
import { createLogger } from '../../utils/logger';

/** OpenAI 兼容 API 配置 */
interface TranslatorConfig {
  apiKey: string;
  apiEndpoint?: string;
  model?: string;
}

/** 极简翻译系统提示（无思考，直译） */
const SYSTEM_PROMPT_BASE = `只输出译文，不要解释。将输入文本翻译成{target}。`;

function getSystemPrompt(targetLanguage: string): string {
  return SYSTEM_PROMPT_BASE.replace(/\{target\}/g, targetLanguage === 'zh-CN' ? '中文' : targetLanguage);
}

/**
 * DeepSeek 流式翻译客户端
 */
export class Translator {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private targetLanguage: string = 'zh-CN';
  private l = createLogger('Translator');

  constructor(config: TranslatorConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.apiEndpoint || TRANSLATE_CONSTANTS.API_BASE_URL;
    this.model = config.model || TRANSLATE_CONSTANTS.MODEL;
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  setApiEndpoint(endpoint: string): void {
    this.baseUrl = endpoint.trim() || this.baseUrl;
  }

  setModel(model: string): void {
    this.model = model;
  }

  setTargetLanguage(lang: string): void {
    this.targetLanguage = lang;
  }

  /**
   * 流式翻译文本
   * @param text - 待翻译的原文
   * @param context - 上下文翻译对（最近 N 句）
   * @yields 翻译 token 片段
   */
  async *translate(text: string, context: TranslationPair[]): AsyncGenerator<string> {
    this.l.info('开始翻译', { textLen: text.length, contextLen: context.length });
    const messages = this.buildMessages(text, context);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: true,
          max_tokens: 256,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(TRANSLATE_CONSTANTS.TRANSLATION_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`DeepSeek API 错误: ${response.status} ${response.statusText} — ${errorBody}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取响应流');

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              this.l.info('翻译完成', { textLen: text.length });
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) yield content;
            } catch {
              // 忽略解析失败的行
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      this.l.info('翻译完成', { textLen: text.length });
    } catch (err) {
      this.l.error('翻译失败', { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * 构建翻译上下文窗口字符串
   * @param recentTranslations - 最近的翻译对列表
   * @param maxCount - 最大保留句数
   * @returns 格式化的上下文字符串
   */
  buildContextWindow(recentTranslations: TranslationPair[], maxCount: number): string {
    if (recentTranslations.length === 0) return '';

    const window = recentTranslations.slice(-maxCount);
    return window.map((t) => `原文: ${t.original}\n译文: ${t.translation}`).join('\n---\n');
  }

  /**
   * 翻译完整句子（非流式，用于纠正检测）
   * @param text - 待翻译的原文
   * @param context - 上下文
   * @returns 完整翻译结果
   */
  async translateFull(text: string, context: TranslationPair[]): Promise<string> {
    const messages = this.buildMessages(text, context);

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        temperature: TRANSLATE_CONSTANTS.TEMPERATURE,
      }),
      signal: AbortSignal.timeout(TRANSLATE_CONSTANTS.TRANSLATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API 错误: ${response.status}`);
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * 生成会话摘要
   * @param sentences - 会话中的翻译句子列表
   * @returns 摘要文本
   */
  async generateSummary(sentences: TranslationResult[]): Promise<string> {
    this.l.info('开始生成摘要', { sentenceCount: sentences.length });
    const content = sentences.map((s) => `原文: ${s.original}\n译文: ${s.translation}`).join('\n---\n');

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              '你是一个会议摘要助手。请根据提供的会议记录生成简洁的摘要，包含：1）主要议题 2）关键结论 3）待办事项（如有）。',
          },
          { role: 'user', content: `请为以下会议记录生成摘要：\n\n${content}` },
        ],
        stream: false,
        temperature: 0.5,
      }),
      signal: AbortSignal.timeout(TRANSLATE_CONSTANTS.TRANSLATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`摘要生成失败: ${response.status}`);
    }

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const summary = data.choices?.[0]?.message?.content || '';
    this.l.info('摘要生成完成');
    return summary;
  }

  /** 构建 API 请求消息数组（极简模式） */
  private buildMessages(text: string, context: TranslationPair[]): { role: string; content: string }[] {
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: getSystemPrompt(this.targetLanguage) },
      { role: 'user', content: text },
    ];
    return messages;
  }
}

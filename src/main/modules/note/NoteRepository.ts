import { promises as fs } from 'fs';
import { dirname, join, normalize, resolve } from 'path';
import { NOTE_CONSTANTS } from '../../../shared/constants';
import type { Session, STTResult, TranslationResult } from '../../../shared/types';
import { createLogger } from '../../utils/logger';

type NoteSentence = STTResult | (TranslationResult & { timestamp: number });

export class NoteRepository {
  private l = createLogger('NoteRepository');

  async createSessionNote(session: Session, saveDir: string): Promise<string> {
    const filePath = this.buildFilePath(session, saveDir);
    const header = `${this.formatSessionHeader(session)}\n---\n`;
    await this.writeWithRetry(filePath, header, false);
    this.l.info('Session note created', { filePath });
    return filePath;
  }

  async appendSentence(filePath: string, sentence: NoteSentence): Promise<void> {
    if (!sentence.isFinal) {
      return;
    }

    const line = this.formatSentenceLine(sentence);
    if (!line) {
      return;
    }

    await this.writeWithRetry(filePath, line, true);
    this.l.debug('Sentence written to note', { filePath, sentenceId: sentence.sentenceId });
  }

  async appendSummary(filePath: string, summary: string): Promise<void> {
    const text = summary.trim();
    if (!text) {
      return;
    }

    const block = `\n<!-- summary -->\n${text}\n<!-- /summary -->\n`;
    await this.writeWithRetry(filePath, block, true);
    this.l.info('Summary written to note', { filePath });
  }

  private buildFilePath(session: Session, saveDir: string): string {
    const start = new Date(session.startTime);
    return join(resolve(saveDir), this.formatDate(start), `${this.formatHourMinute(start)}.md`);
  }

  private formatSessionHeader(session: Session): string {
    const start = new Date(session.startTime);
    return `# ${this.formatDate(start)} ${this.formatTime(start)} \u8bb0\u5f55\n\n> \u97f3\u9891\u6e90: ${session.audioSource}`;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatTime(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  private formatSentenceLine(sentence: NoteSentence): string {
    const time = this.formatTime(new Date(sentence.timestamp));

    if ('original' in sentence) {
      const original = sentence.original.trim();
      const translation = sentence.translation.trim();
      if (!original) {
        return '';
      }

      const translationLine = translation || (sentence.error ? `[translation failed: ${sentence.error}]` : '');
      return translationLine
        ? `${time} | ${original}\n          | ${translationLine}\n`
        : `${time} | ${original}\n`;
    }

    const text = sentence.text.trim();
    return text ? `${time} | ${text}\n` : '';
  }

  private formatHourMinute(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}-${m}`;
  }

  private async writeWithRetry(filePath: string, content: string, append: boolean): Promise<void> {
    const normalizedPath = resolve(normalize(filePath));
    await fs.mkdir(dirname(normalizedPath), { recursive: true });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < NOTE_CONSTANTS.WRITE_RETRY_COUNT; attempt += 1) {
      try {
        if (append) {
          await fs.appendFile(normalizedPath, content, 'utf-8');
        } else {
          await fs.writeFile(normalizedPath, content, 'utf-8');
        }
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < NOTE_CONSTANTS.WRITE_RETRY_COUNT - 1) {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, NOTE_CONSTANTS.WRITE_RETRY_INTERVAL_MS));
        }
      }
    }

    throw new Error(`Note write failed: ${lastError?.message ?? 'unknown error'}`);
  }
}

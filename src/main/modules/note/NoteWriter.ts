/**
 * Markdown 笔记写入模块
 * 负责将翻译结果实时写入 Markdown 文件，支持纠正脚注和摘要
 */

import { promises as fs } from 'fs';
import { resolve, normalize, join } from 'path';
import { homedir } from 'os';
import { createLogger } from '../../utils/logger';
import { NOTE_CONSTANTS } from '../../../shared/constants';
import {
  formatSessionHeader,
  formatTranslationEntry,
  formatCorrectionEntry,
} from '../../utils/markdownFormatter';
import type { Session, Correction } from '../../../shared/types';
import { isCorrection } from '../../../shared/types';

/**
 * Markdown 笔记写入模块
 */
export class NoteWriter {
  private l = createLogger('NoteWriter');
  private noteDir: string;
  private noteDirResolved: string;

  constructor(noteDir?: string) {
    this.noteDir = noteDir || join(homedir(), NOTE_CONSTANTS.DEFAULT_SAVE_DIR);
    this.noteDirResolved = resolve(this.noteDir);
  }

  /**
   * 创建新会话的笔记文件
   * @param session - 会话信息
   * @returns 笔记文件路径
   */
  createNoteFile(session: Session): string {
    const filePath = this.generateFilePath(session);
    this.l.info('笔记文件已创建', { filePath });
    return filePath;
  }

  /**
   * 追加翻译条目到笔记文件
   * @param filePath - 笔记文件路径
   * @param original - 原文
   * @param translation - 译文
   * @param timestamp - 时间戳
   * @param corrections - 纠正记录（可选）
   */
  async appendEntry(
    filePath: string,
    original: string,
    translation: string,
    timestamp: number,
    corrections?: Correction[],
  ): Promise<void> {
    let content = formatTranslationEntry(original, translation, timestamp);

    if (corrections && corrections.length > 0) {
      for (const corr of corrections) {
        if (isCorrection(corr)) {
          content += formatCorrectionEntry(corr);
        }
      }
    }

    content += '\n';
    await this.retryWrite(filePath, content, true);
    this.l.debug('笔记条目已写入', { filePath, sentenceLen: original.length });
  }

  /**
   * 追加纠正脚注到笔记文件
   * @param filePath - 笔记文件路径
   * @param correction - 纠正信息
   */
  async appendCorrectionFootnote(filePath: string, correction: Correction): Promise<void> {
    const content = formatCorrectionEntry(correction) + '\n';
    await this.retryWrite(filePath, content, true);
  }

  /**
   * 追加摘要到笔记文件
   * @param filePath - 笔记文件路径
   * @param summary - 摘要内容
   */
  async appendSummary(filePath: string, summary: string): Promise<void> {
    // HTML 注释标记包裹，前端提取后阅读区不渲染
    const content = `\n<!-- summary -->\n${summary}\n<!-- /summary -->\n`;
    await this.retryWrite(filePath, content, true);
    this.l.info('摘要已写入笔记', { filePath });
  }

  /**
   * 写入会话头部到文件（首次创建文件时调用）
   * @param filePath - 笔记文件路径
   * @param session - 会话信息
   * @param sentenceCount - 句子数
   * @param duration - 时长字符串
   */
  async writeHeader(
    filePath: string,
    session: { startTime: number; audioSource: string },
    sentenceCount: number,
    duration: string,
  ): Promise<void> {
    const header = formatSessionHeader({ ...session, sentenceCount, duration }) + '\n---\n';
    await this.retryWrite(filePath, header, false);
  }

  /**
   * 根据会话信息生成文件路径
   * @param session - 会话信息
   * @returns 格式化的文件路径（YYYY-MM-DD/HH-mm.md）
   */
  generateFilePath(session: Session): string {
    const date = new Date(session.startTime);
    const dateDir = formatDateDir(date);
    const fileName = formatFileName(date);

    return join(this.noteDir, dateDir, fileName);
  }

  /** 校验目标路径是否在 noteDir 内，防止 ../ 目录穿越攻击 */
  private validatePath(targetPath: string): string {
    const resolved = resolve(normalize(targetPath));
    if (!resolved.startsWith(this.noteDirResolved + '\\') && !resolved.startsWith(this.noteDirResolved + '/') && resolved !== this.noteDirResolved) {
      return '';
    }
    return resolved;
  }

  /**
   * 带重试的文件写入
   * @param filePath - 文件路径
   * @param content - 内容
   * @param append - 是否追加（true=append, false=write）
   */
  private async retryWrite(filePath: string, content: string, append: boolean): Promise<void> {
    const safePath = this.validatePath(filePath);
    if (!safePath) {
      this.l.error('路径校验失败，拒绝写入', { filePath });
      return;
    }
    await this.ensureDir(safePath);

    let lastError: Error | null = null;

    for (let i = 0; i < NOTE_CONSTANTS.WRITE_RETRY_COUNT; i++) {
      try {
        if (append) {
          await fs.appendFile(safePath, content, 'utf-8');
        } else {
          await fs.writeFile(safePath, content, 'utf-8');
        }
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (i < NOTE_CONSTANTS.WRITE_RETRY_COUNT - 1) {
          await new Promise((r) => setTimeout(r, NOTE_CONSTANTS.WRITE_RETRY_INTERVAL_MS));
        }
      }
    }

    this.l.error('笔记写入失败', { filePath: safePath, error: lastError?.message });
    throw new Error(`笔记写入失败（已重试 ${NOTE_CONSTANTS.WRITE_RETRY_COUNT} 次）: ${lastError?.message}`);
  }

  /** 确保文件所在目录存在 */
  private async ensureDir(filePath: string): Promise<void> {
    const dir = filePath.substring(0, filePath.lastIndexOf('/') > -1 ? filePath.lastIndexOf('/') : filePath.lastIndexOf('\\'));
    if (dir) {
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
    }
  }
}

/** 格式化日期目录名 YYYY-MM-DD */
function formatDateDir(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 格式化文件名 HH-mm.md */
function formatFileName(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}-${m}.md`;
}

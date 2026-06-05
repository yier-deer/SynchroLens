/**
 * Markdown 格式化工具模块
 * 负责生成符合 DATA_MODEL.md 规范的 Markdown 笔记内容
 */

/**
 * 格式化会话头部信息
 * @param session - 会话信息
 * @returns Markdown 格式的会话头部
 */
export function formatSessionHeader(session: {
  startTime: number;
  audioSource: string;
  sentenceCount: number;
  duration: string;
}): string {
  const date = new Date(session.startTime);
  const dateStr = formatDate(date);
  const timeStr = formatTime(date);

  return `# ${dateStr} ${timeStr} 翻译会话\n\n> 音频源: ${session.audioSource} | 时长: ${session.duration} | 句子数: ${session.sentenceCount}\n`;
}

/**
 * 格式化单条翻译条目
 * @param original - 原文
 * @param translated - 译文
 * @param timestamp - 时间戳（毫秒，epoch time）
 * @returns Markdown 格式的翻译条目
 */
export function formatTranslationEntry(original: string, translated: string, timestamp: number): string {
  const timeStr = formatTime(new Date(timestamp));
  return `${timeStr} | ${original}\n          | ${translated}\n`;
}

/**
 * 格式化纠正条目
 * @param correction - 纠正信息
 * @returns Markdown 格式的纠正脚注
 */
export function formatCorrectionEntry(correction: { from: string; to: string; reason: string }): string {
  return `          | > ~~${correction.from}~~ → ${correction.to}（${correction.reason}）\n`;
}

/**
 * 组装完整的 Markdown 文档
 * @param header - 会话头部
 * @param entries - 翻译条目列表
 * @param summary - 摘要内容（可选）
 * @returns 完整的 Markdown 文档
 */
export function buildMarkdownDocument(header: string, entries: string[], summary?: string): string {
  let doc = header;

  if (entries.length > 0) {
    doc += `\n---\n\n${entries.join('\n')}\n---\n`;
  } else {
    doc += '\n---\n';
  }

  if (summary) {
    doc += `\n${summary}\n`;
  }

  return doc;
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param date - 日期对象
 * @returns 格式化后的日期字符串
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化时间为 HH:mm:ss
 * @param date - 日期对象
 * @returns 格式化后的时间字符串
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

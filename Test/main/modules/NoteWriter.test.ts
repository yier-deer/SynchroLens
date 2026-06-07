/**
 * NoteWriter Markdown 笔记写入模块单元测试
 * 测试笔记文件创建、翻译条目追加、纠正脚注、摘要、文件路径生成
 */

import { NoteWriter } from '../../../src/main/modules/note/NoteWriter';
import type { Session, Correction } from '../../../src/shared/types';

jest.mock('../../../src/main/utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('fs', () => {
  const mockAppendFile = jest.fn().mockResolvedValue(undefined);
  const mockWriteFile = jest.fn().mockResolvedValue(undefined);
  const mockMkdir = jest.fn().mockResolvedValue(undefined);
  return {
    promises: {
      appendFile: mockAppendFile,
      writeFile: mockWriteFile,
      mkdir: mockMkdir,
    },
    __mockAppendFile: mockAppendFile,
    __mockWriteFile: mockWriteFile,
    __mockMkdir: mockMkdir,
  };
});

jest.mock('os', () => ({
  homedir: jest.fn().mockReturnValue('/home/test'),
  release: jest.fn().mockReturnValue('10.0.0'),
}));

jest.mock('../../../src/main/utils/markdownFormatter', () => ({
  formatSessionHeader: jest.fn(
    (s: { startTime: number; audioSource: string; sentenceCount: number; duration: string }) =>
      `# Session ${s.duration}\n`,
  ),
  formatTranslationEntry: jest.fn(
    (original: string, translated: string) => `- **EN**: ${original}\n  **ZH**: ${translated}\n`,
  ),
  formatCorrectionEntry: jest.fn(
    (corr: Correction) => `> \u{1F527} ${corr.from} \u2192 ${corr.to} (${corr.reason})\n`,
  ),
  buildMarkdownDocument: jest.fn(),
}));

function getMockAppendFile(): jest.Mock {
  return require('fs').__mockAppendFile;
}
function getMockWriteFile(): jest.Mock {
  return require('fs').__mockWriteFile;
}

function makeCorrection(overrides: Partial<Correction> = {}): Correction {
  return {
    from: 'old',
    to: 'new',
    reason: '修复',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    startTime: new Date('2026-06-05T14:30:00').getTime(),
    audioSource: 'system',
    sentences: [],
    ...overrides,
  };
}

describe('NoteWriter Markdown 笔记写入模块', () => {
  let noteWriter: NoteWriter;
  let mockAppendFile: jest.Mock;
  let mockWriteFile: jest.Mock;

  beforeEach(() => {
    mockAppendFile = getMockAppendFile();
    mockWriteFile = getMockWriteFile();

    // 重置 mock 实现为默认成功
    mockAppendFile.mockReset().mockResolvedValue(undefined);
    mockWriteFile.mockReset().mockResolvedValue(undefined);
    require('fs').__mockMkdir.mockReset().mockResolvedValue(undefined);

    noteWriter = new NoteWriter('/custom/notes');
  });

  describe('generateFilePath 文件路径生成', () => {
    it('应该根据会话时间生成正确格式的文件路径', () => {
      const session = makeSession();
      const filePath = noteWriter.generateFilePath(session);

      expect(filePath).toMatch(/2026-06-05/);
      expect(filePath).toMatch(/14-30\.md$/);
      expect(filePath).toMatch(/custom[/\\]notes/);
    });
  });

  describe('createNoteFile 创建笔记文件', () => {
    it('应该返回以 .md 结尾的文件路径', () => {
      const session = makeSession();
      const filePath = noteWriter.createNoteFile(session);

      expect(filePath).toMatch(/\.md$/);
      expect(filePath.length).toBeGreaterThan(10);
    });
  });

  describe('appendEntry 追加翻译条目', () => {
    it('应该向文件追加格式化后的翻译条目', async () => {
      const filePath = '/custom/notes/2026-06-05/14-30.md';

      await noteWriter.appendEntry(filePath, 'Hello', '你好', Date.now());

      expect(mockAppendFile).toHaveBeenCalledTimes(1);
      const callArgs = mockAppendFile.mock.calls[0];
      // validatePath normalizes to platform path
      const normalized = callArgs[0];
      expect(normalized.replace(/\\/g, '/')).toContain('custom/notes/2026-06-05/14-30.md');
      expect(callArgs[1]).toContain('Hello');
      expect(callArgs[1]).toContain('你好');
    });

    it('应该在附带纠正记录时追加纠正脚注', async () => {
      const filePath = '/custom/notes/2026-06-05/14-30.md';
      const corrections = [makeCorrection()];

      await noteWriter.appendEntry(filePath, 'Hello', '你好', Date.now(), corrections);

      const content = mockAppendFile.mock.calls[0][1] as string;
      expect(content).toMatch(/\u{1F527}/u);
    });

    it('应该在写入失败时自动重试最多3次', async () => {
      mockAppendFile
        .mockRejectedValueOnce(new Error('EIO'))
        .mockRejectedValueOnce(new Error('EIO'))
        .mockResolvedValueOnce(undefined);

      await noteWriter.appendEntry('/custom/notes/test.md', 'Hello', '你好', Date.now());

      expect(mockAppendFile).toHaveBeenCalledTimes(3);
    });

    it('应该在重试3次后仍然失败时抛出异常', async () => {
      mockAppendFile.mockRejectedValue(new Error('EIO'));

      await expect(
        noteWriter.appendEntry('/custom/notes/test.md', 'Hello', '你好', Date.now()),
      ).rejects.toThrow('笔记写入失败');
    });
  });

  describe('appendCorrectionFootnote 追加纠正脚注', () => {
    it('应该向文件追加纠正脚注内容', async () => {
      // 重置为成功
      mockAppendFile.mockResolvedValue(undefined);

      const correction = makeCorrection({ from: '错误', to: '正确', reason: '术语不一致' });

      await noteWriter.appendCorrectionFootnote('/custom/notes/test.md', correction);

      expect(mockAppendFile).toHaveBeenCalledTimes(1);
      const content = mockAppendFile.mock.calls[0][1] as string;
      expect(content).toMatch(/\u{1F527}/u);
    });
  });

  describe('appendSummary 追加摘要', () => {
    it('应该向文件追加摘要内容', async () => {
      // 重置为成功
      mockAppendFile.mockResolvedValue(undefined);

      await noteWriter.appendSummary('/custom/notes/test.md', '这是一段摘要');

      expect(mockAppendFile).toHaveBeenCalledTimes(1);
      const content = mockAppendFile.mock.calls[0][1] as string;
      expect(content).toContain('摘要');
      expect(content).toContain('这是一段摘要');
    });
  });

  describe('writeHeader 写入会话头部', () => {
    it('应该写入会话头部信息', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await noteWriter.writeHeader(
        '/custom/notes/test.md',
        { startTime: Date.now(), audioSource: 'system' },
        10,
        '00:05:30',
      );

      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const content = mockWriteFile.mock.calls[0][1] as string;
      expect(content).toContain('Session');
    });
  });

  describe('默认笔记目录', () => {
    it('应该在使用默认构造时基于用户目录设置路径', () => {
      const defaultWriter = new NoteWriter();
      const session = makeSession();
      const filePath = defaultWriter.generateFilePath(session);

      expect(filePath).toMatch(/SynchroLens/);
      expect(filePath).toMatch(/2026-06-05/);
    });
  });
});

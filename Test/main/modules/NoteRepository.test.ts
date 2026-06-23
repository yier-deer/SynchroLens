import { NoteRepository } from '../../../src/main/modules/note/NoteRepository';
import type { Session, STTResult, TranslationResult } from '../../../src/shared/types';

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

function getMockAppendFile(): jest.Mock {
  return require('fs').__mockAppendFile;
}

function getMockWriteFile(): jest.Mock {
  return require('fs').__mockWriteFile;
}

function getMockMkdir(): jest.Mock {
  return require('fs').__mockMkdir;
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    startTime: new Date('2026-06-21T10:00:00').getTime(),
    audioSource: 'system',
    sentences: [],
    ...overrides,
  };
}

function makeSentence(overrides: Partial<STTResult> = {}): STTResult {
  return {
    sentenceId: 'sent-1',
    text: 'confirmed sentence',
    isFinal: true,
    timestamp: new Date('2026-06-21T10:00:05').getTime(),
    ...overrides,
  };
}

function makeTranslation(overrides: Partial<TranslationResult & { timestamp: number }> = {}): TranslationResult & { timestamp: number } {
  return {
    sentenceId: 'sent-1',
    original: 'confirmed sentence',
    translation: '中文翻译',
    isFinal: true,
    timestamp: new Date('2026-06-21T10:00:05').getTime(),
    corrections: [],
    constraints: [],
    ...overrides,
  };
}

describe('NoteRepository', () => {
  let repository: NoteRepository;
  let mockAppendFile: jest.Mock;
  let mockWriteFile: jest.Mock;
  let mockMkdir: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new NoteRepository();
    mockAppendFile = getMockAppendFile();
    mockWriteFile = getMockWriteFile();
    mockMkdir = getMockMkdir();
  });

  it('creates a session note under the configured save directory', async () => {
    const notePath = await repository.createSessionNote(makeSession(), 'D:/fresh-notes');

    expect(notePath.replace(/\\/g, '/')).toContain('D:/fresh-notes/2026-06-21/10-00.md');
    expect(mockMkdir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockWriteFile.mock.calls[0][1]).toContain('# 2026-06-21 10:00:00 记录');
  });

  it('appends each final bilingual translation as markdown text', async () => {
    await repository.appendSentence('D:/fresh-notes/2026-06-21/10-00.md', makeTranslation());

    expect(mockAppendFile).toHaveBeenCalledTimes(1);
    expect(mockAppendFile.mock.calls[0][0].replace(/\\/g, '/')).toContain('D:/fresh-notes/2026-06-21/10-00.md');
    expect(mockAppendFile.mock.calls[0][1]).toContain('10:00:05 | confirmed sentence');
    expect(mockAppendFile.mock.calls[0][1]).toContain('          | 中文翻译');
  });

  it('keeps an untranslated final STT fallback entry when translation is unavailable', async () => {
    await repository.appendSentence('D:/fresh-notes/2026-06-21/10-00.md', makeSentence());

    expect(mockAppendFile).toHaveBeenCalledTimes(1);
    expect(mockAppendFile.mock.calls[0][1]).toContain('10:00:05 | confirmed sentence');
  });

  it('appends session summary as hidden markdown metadata', async () => {
    await repository.appendSummary?.('D:/fresh-notes/2026-06-21/10-00.md', 'summary generated');

    expect(mockAppendFile).toHaveBeenCalledTimes(1);
    expect(mockAppendFile.mock.calls[0][1]).toContain('<!-- summary -->');
    expect(mockAppendFile.mock.calls[0][1]).toContain('summary generated');
    expect(mockAppendFile.mock.calls[0][1]).toContain('<!-- /summary -->');
  });
});

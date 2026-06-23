/**
 * @jest-environment jsdom
 */

import { useEffect } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AppConfig } from '@shared/types';
import { MainWindow } from '../../../../src/renderer/windows/main/MainWindow';

const mockUseSession = jest.fn();
const mockUpdateConfig = jest.fn().mockResolvedValue(undefined);
const mockTriggerSummary = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../../src/renderer/hooks/useIPC', () => ({
  useIPC: () => ({
    on: jest.fn().mockReturnValue(() => {}),
    off: jest.fn(),
    startSession: jest.fn().mockResolvedValue(undefined),
    stopSession: jest.fn().mockResolvedValue(undefined),
    pauseSession: jest.fn().mockResolvedValue(undefined),
    updateConfig: mockUpdateConfig,
    triggerSummary: mockTriggerSummary,
    IPC_CHANNELS: {},
  }),
}));

jest.mock('../../../../src/renderer/hooks/useSession', () => ({
  useSession: () => mockUseSession(),
}));

jest.mock('../../../../src/renderer/components/common/SplashScreen', () => ({
  SplashScreen: ({ onComplete }: { onComplete: () => void }) => {
    useEffect(() => {
      onComplete();
    }, [onComplete]);
    return null;
  },
}));

jest.mock('../../../../src/renderer/components/Sidebar/Sidebar', () => ({
  Sidebar: ({
    onPrepareRecord,
    onViewChange,
  }: {
    onPrepareRecord: () => void;
    onViewChange: (view: 'notes' | 'favorites' | 'dictionary' | 'settings') => void;
  }) => (
    <div>
      <button onClick={onPrepareRecord}>准备录制</button>
      <button onClick={() => onViewChange('settings')}>设置</button>
    </div>
  ),
}));

jest.mock('../../../../src/renderer/components/Notes/NotesView', () => ({
  NotesView: ({ selectedNote, onQuickStart }: { selectedNote?: { path?: string } | null; onQuickStart?: () => void }) => (
    <div>
      <button onClick={onQuickStart}>快速开始</button>
      <div data-testid="selected-note-path">{selectedNote?.path || ''}</div>
    </div>
  ),
}));

jest.mock('../../../../src/renderer/components/SummaryViewer/SummaryViewer', () => ({
  SummaryViewer: ({
    summary,
    onGenerateSummary,
    isRunning,
    status,
  }: {
    summary: string | null;
    onGenerateSummary: () => void;
    isRunning: boolean;
    status?: { state: string; error: string | null };
  }) => (
    <div>
      <button onClick={onGenerateSummary} disabled={!isRunning}>生成摘要</button>
      <div data-testid="summary-text">{summary || ''}</div>
      <div data-testid="summary-status">{status?.state || 'missing'}</div>
      <div data-testid="summary-error">{status?.error || ''}</div>
    </div>
  ),
}));

jest.mock('../../../../src/renderer/components/Favorites/FavoritesView', () => ({
  FavoritesView: () => null,
}));

jest.mock('../../../../src/renderer/components/Dictionary/DictionaryView', () => ({
  DictionaryView: () => null,
}));

jest.mock('../../../../src/renderer/components/SettingsPanel/SettingsPanel', () => ({
  SettingsPanel: ({ config, onSave }: { config: AppConfig; onSave: (config: AppConfig) => void }) => (
    <button
      onClick={() => onSave({
        ...config,
        translation: {
          ...config.translation,
          tencent: {
            ...config.translation.tencent,
            secretId: 'sid-from-settings',
            secretKey: 'secret-from-settings',
          },
        },
      })}
    >
      保存设置
    </button>
  ),
}));

describe('MainWindow recording precheck', () => {
  const prepareRecord = jest.fn().mockResolvedValue(undefined);
  const loadConfig = jest.fn<Promise<AppConfig>, []>();
  const saveConfig = jest.fn().mockResolvedValue(undefined);
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseSession.mockReturnValue({
      sessionState: 'idle',
      sttPartials: [],
      currentTranscript: null,
      confirmedTranscripts: [],
      latestTranscript: null,
      currentTranslation: null,
      confirmedTranslations: [],
      corrections: [],
      notePath: null,
      summary: null,
      enhancementStatus: {
        summary: { state: 'idle', summary: null, error: null },
        correction: { state: 'idle', corrections: [], error: null },
        recommendation: { state: 'idle', recommendations: [], error: null },
      },
      startSession: jest.fn(),
      stopSession: jest.fn(),
      pauseSession: jest.fn(),
      resumeSession: jest.fn(),
      correctTranslation: jest.fn(),
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });

    loadConfig.mockResolvedValue({
      general: {
        language: 'zh-CN',
        theme: 'system',
        minimizeToTray: true,
        autoStart: false,
        showBilingual: false,
        cardStyle: '暗夜蓝',
      },
      stt: {
        provider: 'xfyun-rtasr',
        language: 'zh_cn',
        appId: 'stt-app-id',
        apiKey: 'stt-api-key',
        apiSecret: 'stt-api-secret',
      },
      translation: {
        provider: 'nmt',
        targetLanguage: 'zh-CN',
        contextCorrection: true,
        contextWindowSize: 5,
        apiEndpoint: 'http://127.0.0.1:8765',
        model: 'nmt-default',
        tencent: {
          enabled: true,
          region: 'ap-guangzhou',
          projectId: 0,
          sourceLanguage: 'auto',
          secretKeySaved: false,
        },
      },
      llm: {
        provider: 'deepseek',
        apiEndpoint: 'https://api.deepseek.com',
        apiKey: '',
        model: 'deepseek-v4-flash',
      },
      vector: {},
      note: {
        saveDir: '',
        autoSave: true,
        autoSaveInterval: 5000,
        autoSummary: true,
        summaryThreshold: 20,
      },
      enhancement: {
        enabled: false,
        summaryEnabled: true,
        correctionEnabled: true,
        recommendationEnabled: true,
      },
      audio: {
        source: 'system',
        systemAudioBackend: 'wasapi',
        sampleRate: 16000,
        noiseReduction: false,
      },
    });

    Object.defineProperty(window, 'synchrolens', {
      writable: true,
      value: {
        loadConfig,
        prepareRecord,
        saveConfig,
        listNotes: jest.fn().mockResolvedValue([]),
        on: jest.fn().mockReturnValue(() => {}),
      },
    });
  });

  afterAll(() => {
    alertSpy.mockRestore();
  });

  it('allows recording precheck to pass without DeepSeek key when STT config exists', async () => {
    render(<MainWindow />);

    fireEvent.click(await screen.findByText('准备录制'));

    await waitFor(() => {
      expect(prepareRecord).toHaveBeenCalledTimes(1);
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('switches to the latest saved note path after session stop', async () => {
    mockUseSession.mockReturnValue({
      sessionState: 'stopped',
      sttPartials: [],
      currentTranscript: null,
      confirmedTranscripts: [],
      latestTranscript: null,
      currentTranslation: null,
      confirmedTranslations: [],
      corrections: [],
      notePath: 'D:/fresh-notes/2026-06-21/10-00.md',
      summary: null,
      enhancementStatus: {
        summary: { state: 'idle', summary: null, error: null },
        correction: { state: 'idle', corrections: [], error: null },
        recommendation: { state: 'idle', recommendations: [], error: null },
      },
      startSession: jest.fn(),
      stopSession: jest.fn(),
      pauseSession: jest.fn(),
      resumeSession: jest.fn(),
      correctTranslation: jest.fn(),
    });

    jest.useFakeTimers();
    render(<MainWindow />);

    await waitFor(() => {
      expect(loadConfig).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-note-path').textContent).toBe('');
    });

    await waitFor(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-note-path').textContent).toBe('D:/fresh-notes/2026-06-21/10-00.md');
    });
    jest.useRealTimers();
  });

  it('shows generated summary and triggers summary generation', async () => {
    mockUseSession.mockReturnValue({
      sessionState: 'stopped',
      sttPartials: [],
      currentTranscript: null,
      confirmedTranscripts: [],
      latestTranscript: null,
      currentTranslation: null,
      confirmedTranslations: [],
      corrections: [],
      notePath: null,
      summary: '会议摘要：已生成',
      enhancementStatus: {
        summary: { state: 'completed', summary: '会议摘要：已生成', error: null },
        correction: { state: 'idle', corrections: [], error: null },
        recommendation: { state: 'idle', recommendations: [], error: null },
      },
      startSession: jest.fn(),
      stopSession: jest.fn(),
      pauseSession: jest.fn(),
      resumeSession: jest.fn(),
      correctTranslation: jest.fn(),
    });

    render(<MainWindow />);

    expect((await screen.findByTestId('summary-text')).textContent).toContain('会议摘要：已生成');
  });

  it('triggers summary generation from the summary panel', async () => {
    mockUseSession.mockReturnValue({
      sessionState: 'stopped',
      sttPartials: [],
      currentTranscript: null,
      confirmedTranscripts: [],
      latestTranscript: null,
      currentTranslation: null,
      confirmedTranslations: [{ sentenceId: 's1', original: 'Hello', translation: '你好', isFinal: true, corrections: [] }],
      corrections: [],
      notePath: null,
      summary: null,
      enhancementStatus: {
        summary: { state: 'idle', summary: null, error: null },
        correction: { state: 'idle', corrections: [], error: null },
        recommendation: { state: 'idle', recommendations: [], error: null },
      },
      startSession: jest.fn(),
      stopSession: jest.fn(),
      pauseSession: jest.fn(),
      resumeSession: jest.fn(),
      correctTranslation: jest.fn(),
    });

    render(<MainWindow />);

    fireEvent.click(await screen.findByText('生成摘要'));

    await waitFor(() => {
      expect(mockTriggerSummary).toHaveBeenCalledTimes(1);
    });
  });

  it('passes enhancement summary status through to the summary panel', async () => {
    mockUseSession.mockReturnValue({
      sessionState: 'stopped',
      sttPartials: [],
      currentTranscript: null,
      confirmedTranscripts: [],
      latestTranscript: null,
      currentTranslation: null,
      confirmedTranslations: [{ sentenceId: 's1', original: 'Hello', translation: '你好', isFinal: true, corrections: [] }],
      corrections: [],
      notePath: null,
      summary: null,
      enhancementStatus: {
        summary: { state: 'failed', summary: null, error: 'summary timeout' },
        correction: { state: 'idle', corrections: [], error: null },
        recommendation: { state: 'completed', recommendations: ['kickoff -> 启动会'], error: null },
      },
      startSession: jest.fn(),
      stopSession: jest.fn(),
      pauseSession: jest.fn(),
      resumeSession: jest.fn(),
      correctTranslation: jest.fn(),
    });

    render(<MainWindow />);

    expect((await screen.findByTestId('summary-status')).textContent).toContain('failed');
    expect(screen.getByTestId('summary-error').textContent).toContain('summary timeout');
  });

  it('shows an error toast and does not show saved toast when config persistence fails', async () => {
    saveConfig.mockRejectedValueOnce(new Error('安全存储不可用'));

    render(<MainWindow />);

    fireEvent.click(await screen.findByText('设置'));
    fireEvent.click(await screen.findByText('保存设置'));

    expect(await screen.findByText('设置保存失败')).toBeDefined();
    expect(screen.queryByText('设置已保存')).toBeNull();
    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        translation: expect.objectContaining({
          tencent: expect.objectContaining({
            secretId: 'sid-from-settings',
            secretKey: 'secret-from-settings',
          }),
        }),
      }),
    );
  });
});

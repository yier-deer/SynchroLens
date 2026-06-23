/**
 * SettingsPanel 设置面板单元测试
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPanel } from '../../../src/renderer/components/SettingsPanel/SettingsPanel';
import { DEFAULT_CONFIG } from '../../../src/shared/types';

describe('SettingsPanel 设置面板', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('应该渲染所有设置组标题', () => {
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={jest.fn()} />);

    expect(screen.getByText('🎤 语音识别')).toBeDefined();
    expect(screen.getByText('Realtime translation provider')).toBeDefined();
    expect(screen.getByText('🧠 LLM 增强服务')).toBeDefined();
    expect(screen.getByText('💬 字幕显示')).toBeDefined();
    expect(screen.getByText('🧩 LLM 增强能力')).toBeDefined();
  });

  it('应该渲染拆分后的 NMT 与 LLM 字段文案', () => {
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={jest.fn()} />);

    expect(screen.getByText('STT provider')).toBeDefined();
    expect(screen.getByText('XFYun realtime transcription (RTASR recommended)')).toBeDefined();
    expect(screen.getByText('Translation provider')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Test Tencent TMT' })).toBeDefined();
    expect(screen.getByText('腾讯云 TMT 配置')).toBeDefined();
    expect(screen.getByText('SecretId')).toBeDefined();
    expect(screen.getByText('SecretKey')).toBeDefined();
    expect(screen.getByText('Region')).toBeDefined();
    expect(screen.getByText('ProjectId')).toBeDefined();
    expect(screen.getByText('LLM API 地址')).toBeDefined();
    expect(screen.getByText('LLM API Key')).toBeDefined();
    expect(screen.getByText('LLM 模型')).toBeDefined();
  });

  it('应该渲染保存按钮', () => {
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={jest.fn()} />);

    expect(screen.getByText('💾 保存设置')).toBeDefined();
  });

  it('应该在点击保存时触发 onSave 回调', () => {
    const onSave = jest.fn();
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={onSave} />);

    fireEvent.click(screen.getByText('💾 保存设置'));
    expect(onSave).toHaveBeenCalled();
  });

  it('labels Tencent TMT as the realtime provider and exposes a dedicated TMT test button', () => {
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={jest.fn()} />);

    expect(screen.getByText('Realtime translation provider')).toBeDefined();
    expect(screen.getByText('Translation provider')).toBeDefined();
    expect(screen.queryByText('NMT 鏈嶅姟鍦板潃')).toBeNull();
    expect(screen.queryByText('NMT 妯″瀷')).toBeNull();
    expect(screen.getByRole('button', { name: 'Test Tencent TMT' })).toBeDefined();
  });

  it('shows the recommended RTASR option for STT provider', () => {
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={jest.fn()} />);

    expect(screen.getByText('XFYun realtime transcription (RTASR recommended)')).toBeDefined();
    expect(screen.getByText('IAT is fallback-only for short dictation and may have unstable latency.')).toBeDefined();
  });

  it('saves xfyun-rtasr when selecting the recommended RTASR provider', () => {
    const onSave = jest.fn();
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={onSave} />);

    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'XFYun realtime transcription (RTASR recommended)' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存设置/ }));

    const saved = onSave.mock.calls[0][0];
    expect(saved.stt.provider).toBe('xfyun-rtasr');
  });

  it('saves xfyun-iat when selecting the IAT fallback provider', () => {
    const onSave = jest.fn();
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={onSave} />);

    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'XFYun short dictation fallback (IAT)' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存设置/ }));

    const saved = onSave.mock.calls[0][0];
    expect(saved.stt.provider).toBe('xfyun-iat');
  });

  it('preserves nested Tencent TMT config when editing fields before save', () => {
    const onSave = jest.fn();
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText('SecretId'), { target: { value: 'sid-123' } });
    fireEvent.change(screen.getByPlaceholderText('SecretKey'), { target: { value: 'secret-123' } });
    fireEvent.change(screen.getByDisplayValue('ap-guangzhou'), { target: { value: 'ap-shanghai' } });
    fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '42' } });

    fireEvent.click(screen.getByText('💾 保存设置'));

    const saved = onSave.mock.calls[0][0];
    expect(saved.translation.tencent).toEqual(
      expect.objectContaining({
        enabled: true,
        secretId: 'sid-123',
        secretKey: 'secret-123',
        region: 'ap-shanghai',
        projectId: 42,
        sourceLanguage: 'auto',
      }),
    );
    expect(saved.translation.secretId).toBeUndefined();
    expect(saved.translation.secretKey).toBeUndefined();
    expect(saved.translation.region).toBeUndefined();
    expect(saved.translation.projectId).toBeUndefined();
  });

  it('应该渲染服务商下拉选项', () => {
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={jest.fn()} />);

    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('应该渲染文本输入框', () => {
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={jest.fn()} />);

    const inputs = screen.getAllByRole('textbox');
    // AppID + API Key + API Secret + 模型
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it('shows saved-secret placeholder without revealing the secret value', () => {
    render(
      <SettingsPanel
        config={{
          ...DEFAULT_CONFIG,
          translation: {
            ...DEFAULT_CONFIG.translation,
            tencent: {
              ...DEFAULT_CONFIG.translation.tencent,
              secretKeySaved: true,
            },
          },
        }}
        onSave={jest.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('已保存，留空表示不修改')).toBeDefined();
  });

  it('tests Tencent TMT by checking /health before /translate and surfaces auth failure as fail state', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          provider: 'tencent-tmt',
          configured: true,
          secretKeySaved: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: {
            code: 'TMT_AUTH_FAILED',
            message: '腾讯云 TMT 鉴权失败，请检查 SecretId / SecretKey / 系统时间',
          },
        }),
      });

    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Test Tencent TMT' }));

    await screen.findByText('✗ 连接失败');

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8765/health',
      expect.any(Object),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8765/translate',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('uses the local Tencent TMT adapter for TMT tests even when stale custom endpoint remains in config', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          ok: true,
          provider: 'tencent-tmt',
          configured: true,
          secretKeySaved: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ translation: 'pong' }),
      });

    render(
      <SettingsPanel
        config={{
          ...DEFAULT_CONFIG,
          translation: {
            ...DEFAULT_CONFIG.translation,
            provider: 'tencent-tmt',
            apiEndpoint: 'https://api.deepseek.com',
            model: 'deepseek-v4-flash',
          },
        }}
        onSave={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Test Tencent TMT' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:8765/health',
      expect.any(Object),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:8765/translate',
      expect.objectContaining({
        body: expect.stringContaining('"model":"tencent-tmt"'),
      }),
    );
  });
});

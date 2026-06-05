/**
 * SettingsPanel 设置面板单元测试
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '../../../src/renderer/components/SettingsPanel/SettingsPanel';
import type { AppConfig } from '../../../src/shared/types';
import { DEFAULT_CONFIG } from '../../../src/shared/types';

describe('SettingsPanel 设置面板', () => {
  it('应该渲染所有设置组标题', () => {
    render(<SettingsPanel config={DEFAULT_CONFIG} onSave={jest.fn()} />);

    expect(screen.getByText('🎤 语音识别')).toBeDefined();
    expect(screen.getByText('🌐 翻译服务')).toBeDefined();
    expect(screen.getByText('💬 字幕显示')).toBeDefined();
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
});

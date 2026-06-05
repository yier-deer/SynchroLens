/**
 * MainWindow + Sidebar 主窗口布局单元测试
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { MainWindow } from '../../../../src/renderer/windows/main/MainWindow';

// Mock Hooks
jest.mock('../../../../src/renderer/hooks/useIPC', () => ({
  useIPC: () => ({
    on: jest.fn().mockReturnValue(() => {}),
    off: jest.fn(),
    startSession: jest.fn().mockResolvedValue(undefined),
    stopSession: jest.fn().mockResolvedValue(undefined),
    pauseSession: jest.fn().mockResolvedValue(undefined),
    updateConfig: jest.fn().mockResolvedValue(undefined),
    triggerSummary: jest.fn().mockResolvedValue(undefined),
    IPC_CHANNELS: {},
  }),
}));

jest.mock('../../../../src/renderer/hooks/useSession', () => ({
  useSession: () => ({
    sessionState: 'idle',
    sttPartials: [],
    currentTranslation: null,
    confirmedTranslations: [],
    corrections: [],
    notePath: null,
    summary: null,
    startSession: jest.fn(),
    stopSession: jest.fn(),
    pauseSession: jest.fn(),
    correctTranslation: jest.fn(),
  }),
}));

describe('主窗口 MainWindow 三栏布局', () => {
  it('应该渲染左侧栏功能按钮', () => {
    render(<MainWindow />);

    expect(screen.getByText('📝 笔记')).toBeDefined();
    expect(screen.getByText('📖 词典')).toBeDefined();
    expect(screen.getByText('🧠 记忆')).toBeDefined();
    expect(screen.getByText('⚙️ 设置')).toBeDefined();
  });

  it('应该渲染录制按钮', () => {
    render(<MainWindow />);

    expect(screen.getByText('🔴 开始录制')).toBeDefined();
  });

  it('应该渲染右侧摘要栏', () => {
    render(<MainWindow />);

    expect(screen.getByText('📊 摘要')).toBeDefined();
    expect(screen.getByText('隐藏')).toBeDefined();
  });

  it('应该在点击隐藏后收起摘要栏', () => {
    render(<MainWindow />);

    const hideBtn = screen.getByText('隐藏');
    fireEvent.click(hideBtn);

    expect(screen.queryByText('📊 摘要')).toBeNull();
  });

  it('应该在点击设置后切换到设置视图', () => {
    render(<MainWindow />);

    fireEvent.click(screen.getByText('⚙️ 设置'));

    expect(screen.getByText('✕')).toBeDefined();
  });

  it('应该在设置视图中点击关闭返回笔记', () => {
    render(<MainWindow />);

    fireEvent.click(screen.getByText('⚙️ 设置'));
    fireEvent.click(screen.getByText('✕'));

    expect(screen.getByText('📝 实时笔记')).toBeDefined();
  });

  it('应该禁用词典和记忆按钮', () => {
    render(<MainWindow />);

    const dictBtn = screen.getByText('📖 词典').closest('button')!;
    const memBtn = screen.getByText('🧠 记忆').closest('button')!;

    expect(dictBtn.disabled).toBe(true);
    expect(memBtn.disabled).toBe(true);
  });
});

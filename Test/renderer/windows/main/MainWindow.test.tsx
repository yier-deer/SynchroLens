/**
 * MainWindow + Sidebar 主窗口布局单元测试
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { MainWindow } from '../../../../src/renderer/windows/main/MainWindow';

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
  it('应该渲染功能按钮组（5 个按钮含准备录制）', () => {
    render(<MainWindow />);

    expect(screen.getByText('📝 笔记')).toBeDefined();
    expect(screen.getByText('📖 词典')).toBeDefined();
    expect(screen.getByText('🧠 记忆')).toBeDefined();
    expect(screen.getByText('⚙️ 设置')).toBeDefined();
    expect(screen.getByText('🎬 准备录制')).toBeDefined();
  });

  it('不应该渲染历史会话区域', () => {
    render(<MainWindow />);

    expect(screen.queryByText('历史会话')).toBeNull();
  });

  it('应该渲染右侧摘要栏和隐藏按钮', () => {
    render(<MainWindow />);

    expect(screen.getByText('📊 摘要')).toBeDefined();
    expect(screen.getByText('隐藏')).toBeDefined();
  });

  it('应该在点击隐藏后按钮变为显示且不消失', () => {
    render(<MainWindow />);

    fireEvent.click(screen.getByText('隐藏'));

    expect(screen.getByText('显示')).toBeDefined();
    expect(screen.getByText('📊 摘要')).toBeDefined();
  });

  it('应该在点击显示后恢复摘要并切换按钮文字', () => {
    render(<MainWindow />);

    fireEvent.click(screen.getByText('隐藏'));
    fireEvent.click(screen.getByText('显示'));

    expect(screen.getByText('隐藏')).toBeDefined();
  });

  it('应该在点击设置后渲染设置面板', () => {
    render(<MainWindow />);

    fireEvent.click(screen.getByText('⚙️ 设置'));

    expect(screen.getByText('💾 保存设置')).toBeDefined();
  });

  it('准备录制按钮应该在功能按钮组中', () => {
    render(<MainWindow />);

    const recordBtn = screen.getByText('🎬 准备录制');
    expect(recordBtn).toBeDefined();
  });
});

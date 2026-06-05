/**
 * ControlBar 控制栏组件单元测试
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ControlBar } from '../../../../src/renderer/components/ControlBar/ControlBar';

describe('ControlBar 控制栏组件', () => {
  const defaultProps = {
    sessionState: 'idle' as const,
    subtitleVisible: true,
    onToggleRecording: jest.fn(),
    onToggleSubtitle: jest.fn(),
    onMinimize: jest.fn(),
    onExit: jest.fn(),
  };

  it('应该渲染所有控制按钮', () => {
    render(<ControlBar {...defaultProps} />);

    expect(screen.getByText('🎙 SynchroLens')).toBeDefined();
    expect(screen.getByText('▶ 开始')).toBeDefined();
    expect(screen.getByText('字幕: 开')).toBeDefined();
  });

  it('应该在 running 状态显示停止按钮', () => {
    render(<ControlBar {...defaultProps} sessionState="running" />);

    expect(screen.getByText('⏹ 停止')).toBeDefined();
    expect(screen.getByText('● 录制中')).toBeDefined();
  });

  it('应该在点击开始后触发 onToggleRecording', () => {
    const onToggleRecording = jest.fn();
    render(<ControlBar {...defaultProps} onToggleRecording={onToggleRecording} />);

    fireEvent.click(screen.getByText('▶ 开始'));
    expect(onToggleRecording).toHaveBeenCalledTimes(1);
  });

  it('应该在点击字幕后触发 onToggleSubtitle', () => {
    const onToggleSubtitle = jest.fn();
    render(<ControlBar {...defaultProps} onToggleSubtitle={onToggleSubtitle} />);

    fireEvent.click(screen.getByText('字幕: 开'));
    expect(onToggleSubtitle).toHaveBeenCalledTimes(1);
  });

  it('应该在字幕关闭时显示关状态', () => {
    render(<ControlBar {...defaultProps} subtitleVisible={false} />);

    expect(screen.getByText('字幕: 关')).toBeDefined();
  });

  it('应该在点击退出按钮时触发 onExit', () => {
    const onExit = jest.fn();
    render(<ControlBar {...defaultProps} onExit={onExit} />);

    fireEvent.click(screen.getByText('✕'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

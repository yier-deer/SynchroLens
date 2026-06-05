/**
 * NoteViewer + SummaryViewer 组件单元测试
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { NoteViewer } from '../../../src/renderer/components/NoteViewer/NoteViewer';
import { SummaryViewer } from '../../../src/renderer/components/SummaryViewer/SummaryViewer';
import type { TranslationResult } from '../../../src/shared/types';

function makeResult(id: string, original: string, translation: string): TranslationResult {
  return { sentenceId: id, original, translation, isFinal: true, corrections: [] };
}

describe('NoteViewer 笔记查看器', () => {
  it('应该在空状态时显示提示文本', () => {
    render(<NoteViewer translations={[]} isRunning={false} />);
    expect(screen.getByText('暂无笔记内容')).toBeDefined();
  });

  it('应该在运行中空状态时显示等待文本', () => {
    render(<NoteViewer translations={[]} isRunning={true} />);
    expect(screen.getByText('等待翻译结果…')).toBeDefined();
  });

  it('应该渲染翻译条目列表', () => {
    const items = [
      makeResult('s1', 'Hello', '你好'),
      makeResult('s2', 'World', '世界'),
    ];

    render(<NoteViewer translations={items} isRunning={true} />);

    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.getByText('你好')).toBeDefined();
    expect(screen.getByText('World')).toBeDefined();
    expect(screen.getByText('世界')).toBeDefined();
  });
});

describe('SummaryViewer 摘要查看器', () => {
  it('应该在无摘要时显示占位文本', () => {
    render(<SummaryViewer summary={null} onGenerateSummary={jest.fn()} isRunning={false} />);
    expect(screen.getByText('暂无摘要内容')).toBeDefined();
  });

  it('应该在运行中无摘要时显示等待文本', () => {
    render(<SummaryViewer summary={null} onGenerateSummary={jest.fn()} isRunning={true} />);
    expect(screen.getByText('录制完成后可生成摘要')).toBeDefined();
  });

  it('应该在有摘要时显示内容', () => {
    render(
      <SummaryViewer
        summary="会议讨论了三个主要议题。"
        onGenerateSummary={jest.fn()}
        isRunning={false}
      />,
    );

    expect(screen.getByText('会议讨论了三个主要议题。')).toBeDefined();
  });

  it('应该在点击生成摘要按钮时触发回调', () => {
    const onGenerate = jest.fn();
    render(
      <SummaryViewer summary={null} onGenerateSummary={onGenerate} isRunning={true} />,
    );

    fireEvent.click(screen.getByText('🧠 生成摘要'));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('应该在非运行状态禁用生成按钮', () => {
    render(
      <SummaryViewer summary={null} onGenerateSummary={jest.fn()} isRunning={false} />,
    );

    const btn = screen.getByText('🧠 生成摘要').closest('button')!;
    expect(btn.disabled).toBe(true);
  });
});

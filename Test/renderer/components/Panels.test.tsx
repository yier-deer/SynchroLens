/**
 * NoteViewer + SummaryViewer 组件单元测试
 * @jest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { NoteViewer } from '../../../src/renderer/components/NoteViewer/NoteViewer';
import { SummaryViewer } from '../../../src/renderer/components/SummaryViewer/SummaryViewer';
import type { TranslationResult } from '../../../src/shared/types';

function makeResult(id: string, original: string, translation: string): TranslationResult {
  return { sentenceId: id, original, translation, isFinal: true, corrections: [] };
}

describe('NoteViewer 笔记查看器', () => {
  it('should show the empty-state text when there are no translations', () => {
    render(<NoteViewer translations={[]} isRunning={false} />);
    expect(screen.getByText('暂无笔记内容')).toBeDefined();
  });

  it('should show the waiting text while the session is running', () => {
    render(<NoteViewer translations={[]} isRunning={true} />);
    expect(screen.getByText('等待翻译结果…')).toBeDefined();
  });

  it('should render confirmed translation items', () => {
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
  it('should show the empty-state text when no summary exists', () => {
    render(<SummaryViewer summary={null} onGenerateSummary={jest.fn()} isRunning={false} />);
    expect(screen.getByText('暂无摘要内容')).toBeDefined();
  });

  it('should show the ready-state hint when summary can be generated', () => {
    render(<SummaryViewer summary={null} onGenerateSummary={jest.fn()} isRunning={true} />);
    expect(screen.getByText('录制完成后可生成摘要')).toBeDefined();
  });

  it('should render the summary content when available', () => {
    render(
      <SummaryViewer
        summary="会议讨论了三个主要议题。"
        onGenerateSummary={jest.fn()}
        isRunning={false}
      />,
    );

    expect(screen.getByText('会议讨论了三个主要议题。')).toBeDefined();
  });

  it('should call the handler when the generate button is clicked', () => {
    const onGenerate = jest.fn();
    render(<SummaryViewer summary={null} onGenerateSummary={onGenerate} isRunning={true} />);

    fireEvent.click(screen.getByText('生成摘要'));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('should disable the generate button when generation is unavailable', () => {
    render(<SummaryViewer summary={null} onGenerateSummary={jest.fn()} isRunning={false} />);

    const button = screen.getByText('生成摘要').closest('button');
    expect(button?.disabled).toBe(true);
  });

  it('should show running and failed sidecar summary states', () => {
    const { rerender } = render(
      <SummaryViewer
        summary={null}
        onGenerateSummary={jest.fn()}
        isRunning={false}
        status={{ state: 'running', error: null }}
      />,
    );

    expect(screen.getByText('摘要生成中...')).toBeDefined();

    rerender(
      <SummaryViewer
        summary={null}
        onGenerateSummary={jest.fn()}
        isRunning={false}
        status={{ state: 'failed', error: 'summary timeout' }}
      />,
    );

    expect(screen.getByText('summary timeout')).toBeDefined();
  });
});

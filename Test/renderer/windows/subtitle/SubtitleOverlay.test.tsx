/**
 * SubtitleOverlay 字幕渲染组件单元测试
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { SubtitleOverlay } from '../../../../src/renderer/components/SubtitleOverlay/SubtitleOverlay';
import type { TranslationResult } from '../../../../src/shared/types';

/** 创建测试翻译结果 */
function makeResult(
  sentenceId: string,
  original: string,
  translation: string,
  isFinal = true,
): TranslationResult {
  return { sentenceId, original, translation, isFinal, corrections: [] };
}

describe('SubtitleOverlay 字幕渲染组件', () => {
  it('应该在无数据时渲染空容器', () => {
    const { container } = render(
      <SubtitleOverlay currentTranslation={null} confirmedTranslations={[]} />,
    );

    expect(container.firstChild).toBeTruthy();
    // 空状态不崩溃
  });

  it('应该渲染当前句流式文本和闪烁光标', () => {
    const current = makeResult('s1', 'Hello World', '你好', false);

    render(<SubtitleOverlay currentTranslation={current} confirmedTranslations={[]} />);

    expect(screen.getByText('Hello World')).toBeDefined();
    expect(screen.getByText('你好')).toBeDefined();
  });

  it('应该在当前句已确认时不显示光标', () => {
    const current = makeResult('s1', 'Hello', '你好', true);

    render(<SubtitleOverlay currentTranslation={current} confirmedTranslations={[]} />);

    expect(screen.getByText('你好')).toBeDefined();
    // 光标不应存在
  });

  it('应该渲染已确认的翻译句子列表', () => {
    const confirmed = [
      makeResult('s1', 'First', '第一'),
      makeResult('s2', 'Second', '第二'),
    ];

    render(<SubtitleOverlay currentTranslation={null} confirmedTranslations={confirmed} />);

    expect(screen.getByText('First')).toBeDefined();
    expect(screen.getByText('第一')).toBeDefined();
    expect(screen.getByText('Second')).toBeDefined();
    expect(screen.getByText('第二')).toBeDefined();
  });

  it('应该在超过最大句子数时只显示最近N句', () => {
    const confirmed = Array.from({ length: 12 }, (_, i) =>
      makeResult(`s${i}`, `EN ${i}`, `ZH ${i}`),
    );

    render(<SubtitleOverlay currentTranslation={null} confirmedTranslations={confirmed} />);

    // 最早的不应渲染
    expect(screen.queryByText('EN 0')).toBeNull();
    // 最近8句应渲染（MAX_VISIBLE_SENTENCES = 8）
    expect(screen.getByText('EN 4')).toBeDefined();
    expect(screen.getByText('EN 11')).toBeDefined();
  });

  it('应该同时渲染当前句和已确认句', () => {
    const current = makeResult('current', 'Now', '现在', false);
    const confirmed = [makeResult('old', 'Before', '之前')];

    render(<SubtitleOverlay currentTranslation={current} confirmedTranslations={confirmed} />);

    expect(screen.getByText('Now')).toBeDefined();
    expect(screen.getByText('Before')).toBeDefined();
  });
});

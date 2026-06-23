/**
 * @jest-environment jsdom
 */

import { render, screen, act } from '@testing-library/react';
import { NotesView } from '../../../src/renderer/components/Notes/NotesView';
import { ToastProvider } from '../../../src/renderer/components/common/Toast';

const listeners = new Map<string, (data: unknown) => void>();

beforeEach(() => {
  listeners.clear();

  Object.defineProperty(window, 'synchrolens', {
    writable: true,
    value: {
      on: jest.fn((channel: string, callback: (data: unknown) => void) => {
        listeners.set(channel, callback);
        return () => listeners.delete(channel);
      }),
      readNote: jest.fn().mockResolvedValue(''),
      addFavorite: jest.fn().mockResolvedValue(undefined),
      isPersonalDictEnabled: jest.fn().mockResolvedValue(true),
      submitImprovement: jest.fn().mockResolvedValue(undefined),
    },
  });
});

describe('NotesView', () => {
  it('renders streaming and final translation events in the realtime notes panel', async () => {
    render(
      <ToastProvider>
        <NotesView selectedNote={null} onClearSelection={jest.fn()} onQuickStart={jest.fn()} />
      </ToastProvider>,
    );

    act(() => {
      listeners.get('session:state-change')?.({ state: 'running' });
      listeners.get('translate:partial')?.({
        sentenceId: 's1',
        original: 'Hello',
        translation: 'partial',
      });
    });

    expect(screen.getByText('partial')).toBeDefined();

    act(() => {
      listeners.get('translate:final')?.({
        sentenceId: 's1',
        original: 'Hello',
        translation: 'final',
        isFinal: true,
        corrections: [],
      });
    });

    expect(screen.getByText('Hello')).toBeDefined();
    expect(screen.getByText('final')).toBeDefined();
  });

  it('shows translation failure text without breaking the panel', () => {
    render(
      <ToastProvider>
        <NotesView selectedNote={null} onClearSelection={jest.fn()} onQuickStart={jest.fn()} />
      </ToastProvider>,
    );

    act(() => {
      listeners.get('translate:final')?.({
        sentenceId: 's2',
        original: 'Failure case',
        translation: '',
        isFinal: true,
        corrections: [],
        error: 'upstream timeout',
      });
    });

    expect(screen.getByText('Failure case')).toBeDefined();
    expect(screen.getByText('翻译失败：upstream timeout')).toBeDefined();
  });

  it('renders enhancement-sidecar correction and recommendation results without mutating the subtitle main output', () => {
    render(
      <ToastProvider>
        <NotesView selectedNote={null} onClearSelection={jest.fn()} onQuickStart={jest.fn()} />
      </ToastProvider>,
    );

    act(() => {
      listeners.get('translate:final')?.({
        sentenceId: 's3',
        original: 'Project kickoff',
        translation: 'project kickoff translated',
        isFinal: true,
        corrections: [],
      });
      listeners.get('enhancement:status')?.({
        kind: 'correction',
        state: 'completed',
        sessionId: 'session-1',
        corrections: [
          {
            from: 'project kickoff translated',
            to: 'project kickoff improved',
            reason: 'clearer wording',
            timestamp: 1,
          },
        ],
      });
      listeners.get('enhancement:status')?.({
        kind: 'recommendation',
        state: 'completed',
        sessionId: 'session-1',
        recommendations: ['kickoff -> preferred term'],
      });
    });

    expect(screen.getByText('Project kickoff')).toBeDefined();
    expect(screen.getByText('project kickoff translated')).toBeDefined();
    expect(screen.getByText('纠正建议')).toBeDefined();
    expect(screen.getByText('clearer wording')).toBeDefined();
    expect(screen.getByText('词条推荐')).toBeDefined();
    expect(screen.getByText('kickoff -> preferred term')).toBeDefined();
  });
});

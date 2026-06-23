/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DictionaryView } from '../../../src/renderer/components/Dictionary/DictionaryView';
import { ToastProvider } from '../../../src/renderer/components/common/Toast';

describe('DictionaryView', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'synchrolens', {
      writable: true,
      value: {
        listDictionaryFiles: jest.fn().mockResolvedValue([
          { name: 'terms.csv', filePath: 'E:/dict/terms.csv', dictType: 'language', count: 1, enabled: true },
        ]),
        loadDictionaryFile: jest.fn().mockResolvedValue({
          name: 'terms.csv',
          filePath: 'E:/dict/terms.csv',
          dictType: 'language',
          count: 1,
          enabled: true,
        }),
        toggleDictionaryFile: jest.fn().mockResolvedValue(undefined),
        removeDictionaryFile: jest.fn().mockResolvedValue(undefined),
        selectFile: jest.fn().mockResolvedValue(null),
        getDictionaryEntries: jest.fn().mockResolvedValue([]),
        removeDictionaryEntry: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('loads dictionary files from the main process and toggles real file state', async () => {
    render(
      <ToastProvider>
        <DictionaryView />
      </ToastProvider>,
    );

    expect(await screen.findByText('terms.csv')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '禁用 terms.csv' }));

    await waitFor(() => {
      expect(window.synchrolens.toggleDictionaryFile).toHaveBeenCalledWith('language', 'E:/dict/terms.csv', false);
    });
  });
});

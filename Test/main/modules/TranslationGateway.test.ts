import { ContextWindowManager } from '../../../src/main/modules/translate/ContextWindowManager';
import { TranslationGateway } from '../../../src/main/modules/translate/TranslationGateway';
import type { STTResult, TranslationPair } from '../../../src/shared/types';

function makeSentence(sentenceId: string, text: string): STTResult {
  return {
    sentenceId,
    text,
    isFinal: true,
    timestamp: Date.now(),
  };
}

describe('TranslationGateway', () => {
  it('streams cumulative partial translations and stores successful results in context', async () => {
    const translator = {
      translate: jest.fn(async function* (text: string, context: TranslationPair[]) {
        expect(text).toBe('Hello world');
        expect(context).toEqual([{ sentenceId: 'prev', original: 'Previous', translation: '上一句' }]);
        yield '你';
        yield '好世界';
      }),
    };
    const contextWindow = new ContextWindowManager(2);
    contextWindow.remember({
      sentenceId: 'prev',
      original: 'Previous',
      translation: '上一句',
      isFinal: true,
      corrections: [],
    });

    const gateway = new TranslationGateway({ translator, contextWindow });
    const partials: string[] = [];

    const result = await gateway.translateSentence(makeSentence('s1', 'Hello world'), {
      onPartial(payload) {
        partials.push(payload.translation);
        expect(payload.sentenceId).toBe('s1');
        expect(payload.original).toBe('Hello world');
      },
    });

    expect(partials).toEqual(['你', '你好世界']);
    expect(result).toEqual({
      sentenceId: 's1',
      original: 'Hello world',
      translation: '你好世界',
      isFinal: true,
      corrections: [],
      constraints: [],
    });
    expect(contextWindow.getContext()).toEqual([
      { sentenceId: 'prev', original: 'Previous', translation: '上一句' },
      { sentenceId: 's1', original: 'Hello world', translation: '你好世界' },
    ]);
  });

  it('isolates translation failure to the current sentence and keeps context untouched', async () => {
    const translator = {
      translate: jest.fn(async function* () {
        throw new Error('upstream timeout');
      }),
    };
    const contextWindow = new ContextWindowManager(2);
    const gateway = new TranslationGateway({ translator, contextWindow });

    const result = await gateway.translateSentence(makeSentence('s2', 'Failure case'));

    expect(result).toEqual({
      sentenceId: 's2',
      original: 'Failure case',
      translation: '',
      isFinal: true,
      corrections: [],
      constraints: [],
      error: 'upstream timeout',
    });
    expect(contextWindow.getContext()).toEqual([]);
  });

  it('keeps only the most recent N successful translation pairs', async () => {
    const translator = {
      translate: jest.fn(async function* (text: string) {
        yield `ZH:${text}`;
      }),
    };
    const contextWindow = new ContextWindowManager(2);
    const gateway = new TranslationGateway({ translator, contextWindow });

    await gateway.translateSentence(makeSentence('s1', 'one'));
    await gateway.translateSentence(makeSentence('s2', 'two'));
    await gateway.translateSentence(makeSentence('s3', 'three'));

    expect(contextWindow.getContext()).toEqual([
      { sentenceId: 's2', original: 'two', translation: 'ZH:two' },
      { sentenceId: 's3', original: 'three', translation: 'ZH:three' },
    ]);
  });
});

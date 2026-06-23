import { SentenceAssembler } from '../../../src/main/modules/stt/SentenceAssembler';
import type { STTResult } from '../../../src/shared/types';

describe('SentenceAssembler', () => {
  it('emits partial transcript updates', () => {
    const assembler = new SentenceAssembler();
    const events: STTResult[] = [];

    assembler.onSentence((event) => {
      events.push(event);
    });

    assembler.push({ sentenceId: 's1', text: 'hello', isFinal: false, timestamp: 1 });

    expect(events).toEqual([
      { sentenceId: 's1', text: 'hello', isFinal: false, timestamp: 1 },
    ]);
  });

  it('emits final transcript updates and stores history', () => {
    const assembler = new SentenceAssembler();
    const events: STTResult[] = [];

    assembler.onSentence((event) => {
      events.push(event);
    });

    assembler.push({ sentenceId: 's1', text: 'hello', isFinal: false, timestamp: 1 });
    assembler.push({ sentenceId: 's1', text: 'hello world', isFinal: true, timestamp: 2 });

    expect(events).toEqual([
      { sentenceId: 's1', text: 'hello', isFinal: false, timestamp: 1 },
      { sentenceId: 's1', text: 'hello world', isFinal: true, timestamp: 2 },
    ]);
    expect(assembler.getCurrentSentence()).toBeNull();
    expect(assembler.getHistory()).toEqual([
      { sentenceId: 's1', text: 'hello world', isFinal: true, timestamp: 2 },
    ]);
  });

  it('flushes the buffered partial as a final sentence', () => {
    const assembler = new SentenceAssembler();
    const events: STTResult[] = [];

    assembler.onSentence((event) => {
      events.push(event);
    });

    assembler.push({ sentenceId: 's1', text: 'hello', isFinal: false, timestamp: 1 });
    const flushed = assembler.flush();

    expect(flushed).toEqual({ sentenceId: 's1', text: 'hello', isFinal: true, timestamp: 1 });
    expect(events).toEqual([
      { sentenceId: 's1', text: 'hello', isFinal: false, timestamp: 1 },
      { sentenceId: 's1', text: 'hello', isFinal: true, timestamp: 1 },
    ]);
    expect(assembler.getCurrentSentence()).toBeNull();
    expect(assembler.getHistory()).toEqual([
      { sentenceId: 's1', text: 'hello', isFinal: true, timestamp: 1 },
    ]);
  });

  it('ignores empty transcript text', () => {
    const assembler = new SentenceAssembler();
    const handler = jest.fn();

    assembler.onSentence(handler);
    assembler.push({ sentenceId: 's1', text: '   ', isFinal: false, timestamp: 1 });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not force-finalize buffered partials on reset', () => {
    const assembler = new SentenceAssembler();

    assembler.push({ sentenceId: 's1', text: 'hello', isFinal: false, timestamp: 1 });
    assembler.reset();

    expect(assembler.getCurrentSentence()).toBeNull();
    expect(assembler.getHistory()).toEqual([]);
  });
});

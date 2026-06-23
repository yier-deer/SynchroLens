import { AudioFrameBuffer } from '../../../src/main/modules/audio/AudioFrameBuffer';
import { AUDIO_CONSTANTS } from '../../../src/shared/constants';

function samplesPerFrame(): number {
  return AUDIO_CONSTANTS.FRAME_SIZE / Int16Array.BYTES_PER_ELEMENT;
}

describe('AudioFrameBuffer', () => {
  it('emits a fixed-size frame when enough samples arrive', () => {
    const buffer = new AudioFrameBuffer();
    const frames: Int16Array[] = [];

    buffer.onFrame((frame) => {
      frames.push(frame);
    });

    buffer.push(new Int16Array(samplesPerFrame()).fill(1));

    expect(frames).toHaveLength(1);
    expect(frames[0]).toHaveLength(samplesPerFrame());
  });

  it('joins arbitrary chunks into one fixed frame', () => {
    const buffer = new AudioFrameBuffer();
    const frames: Int16Array[] = [];

    buffer.onFrame((frame) => {
      frames.push(frame);
    });

    buffer.push(new Int16Array(100).fill(1));
    buffer.push(new Int16Array(200).fill(2));
    buffer.push(new Int16Array(samplesPerFrame() - 300).fill(3));

    expect(frames).toHaveLength(1);
    expect(Array.from(frames[0].slice(0, 100))).toEqual(new Array(100).fill(1));
    expect(Array.from(frames[0].slice(100, 300))).toEqual(new Array(200).fill(2));
  });

  it('keeps remainder samples and does not flush incomplete frames', () => {
    const buffer = new AudioFrameBuffer();
    const frames: Int16Array[] = [];

    buffer.onFrame((frame) => {
      frames.push(frame);
    });

    buffer.push(new Int16Array(samplesPerFrame() + 13).fill(4));
    buffer.flush();

    expect(frames).toHaveLength(1);
    expect(buffer.getBufferedSampleCount()).toBe(13);
  });

  it('clears buffered samples on reset', () => {
    const buffer = new AudioFrameBuffer();

    buffer.push(new Int16Array(17).fill(7));
    expect(buffer.getBufferedSampleCount()).toBe(17);

    buffer.reset();

    expect(buffer.getBufferedSampleCount()).toBe(0);
  });
});

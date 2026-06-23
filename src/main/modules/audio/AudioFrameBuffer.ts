import { AUDIO_CONSTANTS } from '../../../shared/constants';

type FrameCallback = (frame: Int16Array) => void;

const FRAME_SAMPLES = AUDIO_CONSTANTS.FRAME_SIZE / Int16Array.BYTES_PER_ELEMENT;

export class AudioFrameBuffer {
  private buffered = new Int16Array(0);
  private callbacks = new Set<FrameCallback>();

  push(chunk: Int16Array): void {
    if (chunk.length === 0) {
      return;
    }

    const merged = new Int16Array(this.buffered.length + chunk.length);
    merged.set(this.buffered, 0);
    merged.set(chunk, this.buffered.length);
    this.buffered = merged;

    this.emitCompleteFrames();
  }

  flush(): void {
    this.emitCompleteFrames();
  }

  reset(): void {
    this.buffered = new Int16Array(0);
  }

  onFrame(callback: FrameCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  getBufferedSampleCount(): number {
    return this.buffered.length;
  }

  private emitCompleteFrames(): void {
    while (this.buffered.length >= FRAME_SAMPLES) {
      const frame = this.buffered.slice(0, FRAME_SAMPLES);
      this.buffered = this.buffered.slice(FRAME_SAMPLES);

      for (const callback of this.callbacks) {
        callback(frame);
      }
    }
  }
}

// Jest setup: polyfill for jsdom environment
import { TextEncoder, TextDecoder } from 'util';

// jsdom doesn't have setImmediate, polyfill it
if (typeof global.setImmediate === 'undefined') {
  (global as any).setImmediate = (fn: (...args: any[]) => void, ...args: any[]) => setTimeout(fn, 0, ...args);
}

Object.assign(global, { TextEncoder, TextDecoder });

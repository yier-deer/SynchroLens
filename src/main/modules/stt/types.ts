export type STTProvider = 'xfyun-rtasr' | 'xfyun-iat' | 'whisper-local' | 'whisper-api';

export interface STTCredentials {
  appId: string;
  apiKey: string;
  apiSecret: string;
}

export interface STTConnectOptions extends STTCredentials {
  language: string;
  provider?: STTProvider;
}

export interface STTResultMetadata {
  provider: STTProvider;
  sequence?: number;
  stable?: boolean;
  revision?: boolean;
  firstAudioFrameLatencyMs?: number;
  rawStatus?: number | string;
}

export type STTResultCallback = (
  text: string,
  isFinal: boolean,
  sentenceId: string,
  metadata?: STTResultMetadata,
) => void;

export type STTErrorCallback = (error: Error) => void;
export type STTCloseCallback = () => void;
export type STTClientState = 'connecting' | 'connected' | 'recognizing' | 'reconnecting' | 'failed';
export type STTStateCallback = (state: STTClientState) => void;

export interface ISTTClient {
  connect(config: STTConnectOptions): void;
  sendAudio(pcmChunk: Int16Array): void;
  disconnect(): void;
  onResult(callback: STTResultCallback): void;
  onError?(callback: STTErrorCallback): void;
  onClose?(callback: STTCloseCallback): void;
  onStateChange?(callback: STTStateCallback): void;
  setLanguage?(language: string): void;
  language?: string;
  readonly isConnected: boolean;
}

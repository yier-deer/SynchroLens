import type { TencentTMTConfig, TranslationConstraint, TranslationPair } from '../../../shared/types';

export interface TMTTranslateRequest {
  text: string;
  targetLanguage: string;
  model?: string;
  context?: TranslationPair[];
  constraints?: TranslationConstraint[];
}

export interface TMTTranslateResponse {
  translation: string;
  provider: 'tencent-tmt';
  requestId?: string;
}

export interface TMTErrorShape {
  code:
    | 'TMT_CONFIG_MISSING'
    | 'TMT_UNSUPPORTED_LANGUAGE'
    | 'TMT_AUTH_FAILED'
    | 'TMT_RATE_LIMITED'
    | 'TMT_BAD_REQUEST'
    | 'TMT_UPSTREAM_ERROR';
  message: string;
  providerCode?: string;
  requestId?: string;
}

export interface TMTClientConfig extends Omit<TencentTMTConfig, 'enabled' | 'secretKeySaved'> {
  secretKey?: string;
}

export class TMTError extends Error implements TMTErrorShape {
  code: TMTErrorShape['code'];
  providerCode?: string;
  requestId?: string;

  constructor(shape: TMTErrorShape) {
    super(shape.message);
    this.name = 'TMTError';
    this.code = shape.code;
    this.providerCode = shape.providerCode;
    this.requestId = shape.requestId;
  }
}

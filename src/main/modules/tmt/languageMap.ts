import { TMTError } from './types';

const TARGET_LANGUAGE_MAP: Record<string, 'zh' | 'en' | 'ja' | 'ko'> = {
  'zh-CN': 'zh',
  '中文': 'zh',
  en: 'en',
  'en-US': 'en',
  '英文': 'en',
  ja: 'ja',
  '日文': 'ja',
  ko: 'ko',
  '韩文': 'ko',
};

export function mapTargetLanguage(language: string): 'zh' | 'en' | 'ja' | 'ko' {
  const mapped = TARGET_LANGUAGE_MAP[language];
  if (!mapped) {
    throw new TMTError({
      code: 'TMT_UNSUPPORTED_LANGUAGE',
      message: `TMT_UNSUPPORTED_LANGUAGE: ${language}`,
    });
  }
  return mapped;
}

describe('languageMap', () => {
  it('maps supported SynchroLens languages to Tencent TMT target codes', () => {
    const { mapTargetLanguage } = require('../../../../src/main/modules/tmt/languageMap');

    expect(mapTargetLanguage('zh-CN')).toBe('zh');
    expect(mapTargetLanguage('中文')).toBe('zh');
    expect(mapTargetLanguage('en-US')).toBe('en');
    expect(mapTargetLanguage('en')).toBe('en');
    expect(mapTargetLanguage('英文')).toBe('en');
    expect(mapTargetLanguage('ja')).toBe('ja');
    expect(mapTargetLanguage('日文')).toBe('ja');
    expect(mapTargetLanguage('ko')).toBe('ko');
    expect(mapTargetLanguage('韩文')).toBe('ko');
  });

  it('throws a structured unsupported-language error for unmapped languages', () => {
    const { mapTargetLanguage } = require('../../../../src/main/modules/tmt/languageMap');

    expect(() => mapTargetLanguage('fr-FR')).toThrow('TMT_UNSUPPORTED_LANGUAGE');
  });
});

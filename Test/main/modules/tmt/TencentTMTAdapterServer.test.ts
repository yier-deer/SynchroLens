describe('TencentTMTAdapterServer', () => {
  it('returns config-missing health when credentials are incomplete', async () => {
    const { TencentTMTAdapterServer } = require('../../../../src/main/modules/tmt/TencentTMTAdapterServer');

    const server = new TencentTMTAdapterServer({
      getConfig: () => ({
        secretId: 'sid',
        region: 'ap-guangzhou',
        projectId: 0,
        sourceLanguage: 'auto',
        secretKeySaved: false,
      }),
      client: {
        translate: jest.fn(),
      },
    });

    await expect(server.handleHealth()).resolves.toEqual({
      ok: false,
      provider: 'tencent-tmt',
      configured: false,
      error: {
        code: 'TMT_CONFIG_MISSING',
        message: '腾讯云 TMT SecretId 或 SecretKey 未配置',
      },
    });
  });

  it('translates valid requests through the client', async () => {
    const translate = jest.fn().mockResolvedValue({
      translation: '你好',
      provider: 'tencent-tmt',
      requestId: 'req-1',
    });

    const { TencentTMTAdapterServer } = require('../../../../src/main/modules/tmt/TencentTMTAdapterServer');

    const server = new TencentTMTAdapterServer({
      getConfig: () => ({
        secretId: 'sid',
        region: 'ap-guangzhou',
        projectId: 0,
        sourceLanguage: 'auto',
        secretKeySaved: true,
      }),
      client: {
        translate,
      },
    });

    await expect(server.handleTranslate({
      text: 'Hello',
      targetLanguage: 'zh-CN',
      model: 'tencent-tmt',
      context: [],
      constraints: [],
    })).resolves.toEqual({
      translation: '你好',
      provider: 'tencent-tmt',
      requestId: 'req-1',
    });
  });

  it('returns a structured bad-request error for missing text', async () => {
    const { TencentTMTAdapterServer } = require('../../../../src/main/modules/tmt/TencentTMTAdapterServer');

    const server = new TencentTMTAdapterServer({
      getConfig: () => ({
        secretId: 'sid',
        region: 'ap-guangzhou',
        projectId: 0,
        sourceLanguage: 'auto',
        secretKeySaved: true,
      }),
      client: {
        translate: jest.fn(),
      },
    });

    await expect(server.handleTranslate({
      text: '',
      targetLanguage: 'zh-CN',
      model: 'tencent-tmt',
      context: [],
      constraints: [],
    })).rejects.toMatchObject({
      code: 'TMT_BAD_REQUEST',
    });
  });
});

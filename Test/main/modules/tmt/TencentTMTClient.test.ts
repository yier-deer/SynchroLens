describe('TencentTMTClient', () => {
  it('translates through the injected transport and returns SynchroLens-shaped output', async () => {
    const transport = jest.fn().mockResolvedValue({
      TargetText: '你好',
      RequestId: 'req-1',
    });

    const { TencentTMTClient } = require('../../../../src/main/modules/tmt/TencentTMTClient');

    const client = new TencentTMTClient({
      transport,
      getConfig: () => ({
        secretId: 'sid',
        secretKey: 'skey',
        region: 'ap-guangzhou',
        projectId: 0,
        sourceLanguage: 'auto',
      }),
    });

    await expect(client.translate({
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

    expect(transport).toHaveBeenCalledWith({
      SourceText: 'Hello',
      Source: 'auto',
      Target: 'zh',
      ProjectId: 0,
    });
  });

  it('throws TMT_CONFIG_MISSING when secret config is incomplete', async () => {
    const { TencentTMTClient } = require('../../../../src/main/modules/tmt/TencentTMTClient');

    const client = new TencentTMTClient({
      transport: jest.fn(),
      getConfig: () => ({
        secretId: 'sid',
        region: 'ap-guangzhou',
        projectId: 0,
        sourceLanguage: 'auto',
      }),
    });

    await expect(client.translate({
      text: 'Hello',
      targetLanguage: 'zh-CN',
      model: 'tencent-tmt',
      context: [],
      constraints: [],
    })).rejects.toMatchObject({
      code: 'TMT_CONFIG_MISSING',
    });
  });

  it('maps Tencent auth failures to TMT_AUTH_FAILED', async () => {
    const transport = jest.fn().mockRejectedValue({
      code: 'AuthFailure.SignatureFailure',
      requestId: 'req-auth',
      message: 'signature failure',
    });

    const { TencentTMTClient } = require('../../../../src/main/modules/tmt/TencentTMTClient');

    const client = new TencentTMTClient({
      transport,
      getConfig: () => ({
        secretId: 'sid',
        secretKey: 'skey',
        region: 'ap-guangzhou',
        projectId: 0,
        sourceLanguage: 'auto',
      }),
    });

    await expect(client.translate({
      text: 'Hello',
      targetLanguage: 'zh-CN',
      model: 'tencent-tmt',
      context: [],
      constraints: [],
    })).rejects.toMatchObject({
      code: 'TMT_AUTH_FAILED',
      providerCode: 'AuthFailure.SignatureFailure',
      requestId: 'req-auth',
    });
  });
});

import type { TencentTMTConfig } from '../../../shared/types';
import { mapTargetLanguage } from './languageMap';
import type { TMTClientConfig, TMTTranslateRequest, TMTTranslateResponse } from './types';
import { TMTError } from './types';

type TextTranslatePayload = {
  SourceText: string;
  Source: string;
  Target: string;
  ProjectId: number;
};

type Transport = (payload: TextTranslatePayload) => Promise<{
  TargetText?: string;
  RequestId?: string;
}>;

interface TencentTMTClientOptions {
  getConfig: () => Partial<TencentTMTConfig> & { secretKey?: string };
  transport?: Transport;
}

function createDefaultTransport(config: TMTClientConfig): Transport {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Client } = require('tencentcloud-sdk-nodejs/tencentcloud/services/tmt/v20180321/tmt_client');
  const client = new Client({
    credential: {
      secretId: config.secretId,
      secretKey: config.secretKey,
    },
    region: config.region,
    profile: {
      httpProfile: {
        endpoint: 'tmt.tencentcloudapi.com',
      },
    },
  });

  return (payload) => client.TextTranslate(payload);
}

export class TencentTMTClient {
  private readonly getConfig: TencentTMTClientOptions['getConfig'];
  private readonly injectedTransport?: Transport;

  constructor(options: TencentTMTClientOptions) {
    this.getConfig = options.getConfig;
    this.injectedTransport = options.transport;
  }

  async translate(request: TMTTranslateRequest): Promise<TMTTranslateResponse> {
    const config = this.getConfig();
    if (!config.secretId || !config.secretKey) {
      throw new TMTError({
        code: 'TMT_CONFIG_MISSING',
        message: '腾讯云 TMT SecretId 或 SecretKey 未配置',
      });
    }

    const payload: TextTranslatePayload = {
      SourceText: request.text,
      Source: config.sourceLanguage || 'auto',
      Target: mapTargetLanguage(request.targetLanguage),
      ProjectId: config.projectId ?? 0,
    };

    const transport = this.injectedTransport || createDefaultTransport({
      secretId: config.secretId,
      secretKey: config.secretKey,
      region: config.region || 'ap-guangzhou',
      projectId: config.projectId ?? 0,
      sourceLanguage: config.sourceLanguage || 'auto',
    });

    try {
      const result = await transport(payload);
      return {
        translation: result.TargetText || '',
        provider: 'tencent-tmt',
        requestId: result.RequestId,
      };
    } catch (error) {
      const providerCode = error && typeof error === 'object' ? (error as { code?: string }).code : undefined;
      const requestId = error && typeof error === 'object' ? (error as { requestId?: string }).requestId : undefined;
      if (providerCode === 'AuthFailure.SignatureFailure') {
        throw new TMTError({
          code: 'TMT_AUTH_FAILED',
          message: '腾讯云 TMT 鉴权失败，请检查 SecretId / SecretKey / 系统时间',
          providerCode,
          requestId,
        });
      }
      if (providerCode === 'RequestLimitExceeded') {
        throw new TMTError({
          code: 'TMT_RATE_LIMITED',
          message: '腾讯云 TMT 触发频率限制，请稍后重试',
          providerCode,
          requestId,
        });
      }
      if (error instanceof TMTError) {
        throw error;
      }
      throw new TMTError({
        code: 'TMT_UPSTREAM_ERROR',
        message: error instanceof Error ? error.message : '腾讯云 TMT 调用失败',
        providerCode,
        requestId,
      });
    }
  }
}

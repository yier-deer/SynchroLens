import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import type { TencentTMTConfig } from '../../../shared/types';
import { TencentTMTClient } from './TencentTMTClient';
import type { TMTTranslateRequest, TMTTranslateResponse } from './types';
import { TMTError } from './types';

interface TencentTMTAdapterServerOptions {
  getConfig: () => Partial<TencentTMTConfig> & { secretKey?: string };
  client?: Pick<TencentTMTClient, 'translate'>;
  host?: string;
  port?: number;
}

export class TencentTMTAdapterServer {
  private readonly getConfig: TencentTMTAdapterServerOptions['getConfig'];
  private readonly client: Pick<TencentTMTClient, 'translate'>;
  private readonly host: string;
  private readonly port: number;
  private server: Server | null = null;

  constructor(options: TencentTMTAdapterServerOptions) {
    this.getConfig = options.getConfig;
    this.client = options.client || new TencentTMTClient({ getConfig: options.getConfig });
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 8765;
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = createServer((req, res) => {
      void this.route(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(this.port, this.host, () => resolve());
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    const activeServer = this.server;
    this.server = null;
    await new Promise<void>((resolve, reject) => {
      activeServer.close((error) => (error ? reject(error) : resolve()));
    });
  }

  async handleHealth(): Promise<Record<string, unknown>> {
    const config = this.getConfig();
    if (!config.secretId || (!config.secretKey && !config.secretKeySaved)) {
      return {
        ok: false,
        provider: 'tencent-tmt',
        configured: false,
        error: {
          code: 'TMT_CONFIG_MISSING',
          message: '腾讯云 TMT SecretId 或 SecretKey 未配置',
        },
      };
    }

    return {
      ok: true,
      provider: 'tencent-tmt',
      configured: true,
      secretKeySaved: Boolean(config.secretKeySaved || config.secretKey),
    };
  }

  async handleTranslate(request: TMTTranslateRequest): Promise<TMTTranslateResponse> {
    if (!request.text?.trim()) {
      throw new TMTError({
        code: 'TMT_BAD_REQUEST',
        message: '请求缺少 text',
      });
    }

    return this.client.translate(request);
  }

  private async route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        this.sendJson(res, 200, await this.handleHealth());
        return;
      }

      if (req.url === '/translate' && req.method !== 'POST') {
        this.sendJson(res, 405, {
          error: {
            code: 'TMT_BAD_REQUEST',
            message: 'Only POST /translate is supported',
          },
        });
        return;
      }

      if (req.method === 'POST' && req.url === '/translate') {
        const body = await this.readJsonBody(req);
        const result = await this.handleTranslate(body as TMTTranslateRequest);
        this.sendJson(res, 200, result);
        return;
      }

      this.sendJson(res, 404, {
        error: {
          code: 'TMT_BAD_REQUEST',
          message: 'Not found',
        },
      });
    } catch (error) {
      const tmtError = error instanceof TMTError ? error : new TMTError({
        code: 'TMT_UPSTREAM_ERROR',
        message: error instanceof Error ? error.message : 'Unknown adapter error',
      });
      this.sendJson(res, tmtError.code === 'TMT_BAD_REQUEST' ? 400 : 502, {
        error: {
          code: tmtError.code,
          message: tmtError.message,
          providerCode: tmtError.providerCode,
          requestId: tmtError.requestId,
        },
      });
    }
  }

  private async readJsonBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString('utf-8');
    return raw ? JSON.parse(raw) : {};
  }

  private sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  }
}

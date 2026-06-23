/**
 * 设置面板组件
 * 分组设置：语音识别、翻译服务、向量模型、字幕显示、
 * 笔记设置、收藏设置、快捷键、数据管理
 */

import { useState, useCallback } from 'react';
import type { AppConfig } from '@shared/types';

/** STT 语言显示名 → 讯飞编码映射 */
const STT_LANG_MAP: Record<string, string> = {
  '中文': 'zh_cn',
  '英文': 'en_us',
  '日文': 'ja',
  '韩文': 'ko',
};

const TRANSLATION_TARGET_LANG_MAP: Record<string, string> = {
  '中文': 'zh-CN',
  '英文': 'en-US',
  '日文': 'ja',
  '韩文': 'ko',
};

const TRANSLATION_PROVIDER_MAP: Record<string, string> = {
  '腾讯云 TMT': 'tencent-tmt',
  '自定义 NMT 服务': 'nmt',
};

const STT_PROVIDER_MAP: Record<string, string> = {
  'XFYun realtime transcription (RTASR recommended)': 'xfyun-rtasr',
  'XFYun short dictation fallback (IAT)': 'xfyun-iat',
};

const TMT_SOURCE_LANG_MAP: Record<string, string> = {
  '自动检测': 'auto',
  '中文': 'zh',
  '英文': 'en',
  '日文': 'ja',
  '韩文': 'ko',
};

function toXFyunLang(displayName: string): string {
  return STT_LANG_MAP[displayName] || 'zh_cn';
}

function fromXFyunLang(code: string): string {
  for (const [name, c] of Object.entries(STT_LANG_MAP)) {
    if (c === code) return name;
  }
  return '中文';
}

function toTranslationTargetLang(displayName: string): string {
  return TRANSLATION_TARGET_LANG_MAP[displayName] || 'zh-CN';
}

function fromTranslationTargetLang(code: string): string {
  for (const [name, mapped] of Object.entries(TRANSLATION_TARGET_LANG_MAP)) {
    if (mapped === code) return name;
  }
  return '中文';
}

function toTranslationProvider(displayName: string): string {
  return TRANSLATION_PROVIDER_MAP[displayName] || 'tencent-tmt';
}

function fromTranslationProvider(code: string): string {
  for (const [name, mapped] of Object.entries(TRANSLATION_PROVIDER_MAP)) {
    if (mapped === code) return name;
  }
  return '腾讯云 TMT';
}

function toSttProvider(displayName: string): string {
  return STT_PROVIDER_MAP[displayName] || 'xfyun-rtasr';
}

function fromSttProvider(code: string): string {
  for (const [name, mapped] of Object.entries(STT_PROVIDER_MAP)) {
    if (mapped === code) return name;
  }
  return 'XFYun realtime transcription (RTASR recommended)';
}

function toTmtSourceLang(displayName: string): string {
  return TMT_SOURCE_LANG_MAP[displayName] || 'auto';
}

function fromTmtSourceLang(code: string): string {
  for (const [name, mapped] of Object.entries(TMT_SOURCE_LANG_MAP)) {
    if (mapped === code) return name;
  }
  return '自动检测';
}

/** SettingsPanel 属性 */
interface SettingsPanelProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
  onExportNotes?: () => void;
  onClearData?: () => void;
}

/** 设置组定义 */
interface SettingGroup {
  key: string;
  title: string;
  fields: SettingField[];
}

interface SettingField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'toggle' | 'number' | 'button' | 'testButton';
  options?: string[];
  service?: string;
  defaultValue?: string;
  readOnly?: boolean;
  visibleWhenProvider?: 'tencent-tmt' | 'nmt';
}

interface TmtHealthPayload {
  ok?: boolean;
  configured?: boolean;
  error?: {
    code?: string;
    message?: string;
  };
}

function getValue(config: AppConfig, key: string): unknown {
  const parts = key.split('.');
  let val: unknown = config;
  for (const part of parts) {
    if (val && typeof val === 'object') {
      val = (val as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return val;
}

function cloneConfig(config: AppConfig): AppConfig {
  return JSON.parse(JSON.stringify(config)) as AppConfig;
}

function setDeepValue(config: AppConfig, key: string, value: string | boolean | number): AppConfig {
  const parts = key.split('.');
  if (parts.length < 2) {
    return config;
  }

  const next = cloneConfig(config);
  let cursor: Record<string, unknown> = next as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    const current = cursor[part];
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      cursor[part] = { ...(current as Record<string, unknown>) };
    } else {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}

function shouldRenderField(config: AppConfig, field: SettingField): boolean {
  if (!field.visibleWhenProvider) {
    return true;
  }
  return getValue(config, 'translation.provider') === field.visibleWhenProvider;
}

const GROUPS: SettingGroup[] = [
  {
    key: 'stt',
    title: '🎤 语音识别',
    fields: [
      {
        key: 'stt.provider',
        label: 'STT provider',
        type: 'select',
        options: [
          'XFYun realtime transcription (RTASR recommended)',
          'XFYun short dictation fallback (IAT)',
        ],
        defaultValue: 'XFYun realtime transcription (RTASR recommended)',
      },
      { key: 'stt.appId', label: 'AppID', type: 'text' },
      { key: 'stt.apiKey', label: 'API Key', type: 'password' },
      { key: 'stt.apiSecret', label: 'API Secret', type: 'password' },
      { key: 'stt.language', label: '识别语言', type: 'select', options: ['中文', '英文', '日文', '韩文'], defaultValue: '中文' },
      { key: 'stt.test', label: '测试连接', type: 'testButton', service: 'stt' },
    ],
  },
  {
    key: 'translation',
    title: 'Realtime translation provider',
    fields: [
      { key: 'translation.provider', label: 'Translation provider', type: 'select', options: ['腾讯云 TMT', '自定义 NMT 服务'], defaultValue: '腾讯云 TMT' },
      { key: 'translation.apiEndpoint', label: 'NMT service endpoint', type: 'text', defaultValue: 'http://127.0.0.1:8765', visibleWhenProvider: 'nmt' },
      { key: 'translation.model', label: 'NMT model', type: 'text', defaultValue: 'nmt-default', visibleWhenProvider: 'nmt' },
      { key: 'translation.contextWindowSize', label: '上下文窗口', type: 'number' },
      { key: 'translation.targetLanguage', label: '目标语言', type: 'select', options: ['中文', '英文', '日文', '韩文'] },
    ],
  },
  {
    key: 'tencentTmt',
    title: '腾讯云 TMT 配置',
    fields: [
      { key: 'translation.tencent.secretId', label: 'SecretId', type: 'text' },
      { key: 'translation.tencent.secretKey', label: 'SecretKey', type: 'password' },
      { key: 'translation.tencent.region', label: 'Region', type: 'text', defaultValue: 'ap-guangzhou' },
      { key: 'translation.tencent.projectId', label: 'ProjectId', type: 'number', defaultValue: '0' },
      { key: 'translation.tencent.sourceLanguage', label: '源语言', type: 'select', options: ['自动检测', '中文', '英文', '日文', '韩文'], defaultValue: '自动检测' },
      { key: 'translation.test', label: 'Test Tencent TMT', type: 'testButton', service: 'translation' },
    ],
  },
  {
    key: 'llm',
    title: '🧠 LLM 增强服务',
    fields: [
      { key: 'llm.apiEndpoint', label: 'LLM API 地址', type: 'text', defaultValue: 'https://api.deepseek.com' },
      { key: 'llm.apiKey', label: 'LLM API Key', type: 'password' },
      { key: 'llm.fetchModels', label: '获取 LLM 模型', type: 'button' },
      { key: 'llm.model', label: 'LLM 模型', type: 'select', options: [], defaultValue: 'deepseek-v4-flash' },
      { key: 'llm.test', label: '测试 LLM', type: 'testButton', service: 'llm' },
    ],
  },
  {
    key: 'vector',
    title: '🧠 向量模型',
    fields: [
      { key: 'vector.apiEndpoint', label: 'API 地址', type: 'text', defaultValue: 'https://ark.cn-beijing.volces.com/api/v3' },
      { key: 'vector.apiKey', label: 'Embedding Key', type: 'password' },
      { key: 'vector.fetchModels', label: '获取模型', type: 'button' },
      { key: 'vector.model', label: 'Embedding 模型', type: 'select', options: [], defaultValue: 'doubao-embedding-vision-251215' },
      { key: 'vector.test', label: '测试连接', type: 'testButton', service: 'vector' },
    ],
  },
  {
    key: 'subtitle',
    title: '💬 字幕显示',
    fields: [
      { key: 'general.showBilingual', label: '显示双语', type: 'toggle' },
      { key: 'general.theme', label: '主题', type: 'select', options: ['light', 'dark', 'system'] },
      { key: 'general.autoStart', label: '开机自启', type: 'toggle' },
    ],
  },
  {
    key: 'note',
    title: '📝 笔记设置',
    fields: [
      { key: 'note.saveDir', label: '保存目录', type: 'text', defaultValue: '' },
      { key: 'note.autoSummary', label: '自动总结', type: 'toggle' },
      { key: 'note.summaryThreshold', label: '摘要阈值(句)', type: 'number', defaultValue: '20' },
    ],
  },
  {
    key: 'enhancement',
    title: '🧩 LLM 增强能力',
    fields: [
      { key: 'enhancement.enabled', label: '启用 LLM 增强', type: 'toggle' },
      { key: 'enhancement.summaryEnabled', label: '启用摘要', type: 'toggle' },
      { key: 'enhancement.correctionEnabled', label: '启用纠错建议', type: 'toggle' },
      { key: 'enhancement.recommendationEnabled', label: '启用词条推荐', type: 'toggle' },
    ],
  },
  {
    key: 'favorite',
    title: '⭐ 收藏设置',
    fields: [
      { key: 'general.cardStyle', label: '卡片风格', type: 'select', options: ['暗夜蓝', '深空灰', '墨绿'] },
    ],
  },
  {
    key: 'data',
    title: '📦 数据管理',
    fields: [
      { key: 'export', label: '导出全部笔记', type: 'button' },
    ],
  },
];

/** 样式 */
const S = {
  container: {
    padding: '16px 0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    overflowY: 'auto' as const,
  },
  group: {
    padding: '16px',
    borderRadius: '8px',
    background: '#1f2937',
  },
  groupTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#e5e7eb',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid #374151',
  },
  field: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
  },
  label: {
    fontSize: '14px',
    color: '#d1d5db',
  },
  input: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #374151',
    background: '#111827',
    color: '#e5e7eb',
    fontSize: '13px',
    width: '200px',
  },
  select: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #374151',
    background: '#111827',
    color: '#e5e7eb',
    fontSize: '13px',
  },
  toggle: {
    width: '40px',
    height: '22px',
    borderRadius: '11px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 150ms',
  },
  button: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid #374151',
    background: '#111827',
    color: '#e5e7eb',
    fontSize: '13px',
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    background: '#2563eb',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-end',
  },
} as const;

/**
 * 设置面板
 * 分组管理应用配置（8 分组）
 */
export function SettingsPanel({ config, onSave, onExportNotes, onClearData }: SettingsPanelProps) {
  // 本地草稿：所有修改只更新草稿，点击保存时才提交
  const [draftConfig, setDraftConfig] = useState<AppConfig>({ ...config });
  const [translateModels, setTranslateModels] = useState<string[]>([]);
  const [llmModels, setLlmModels] = useState<string[]>([]);
  const [embeddingModels, setEmbeddingModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});

  /** 服务连接测试 */
  const runServiceTest = useCallback(async (service: string) => {
    setTestResults(prev => ({ ...prev, [service]: 'testing' }));
    setTestMessages(prev => ({ ...prev, [service]: '' }));
    try {
      if (service === 'stt') {
        const appId = getValue(draftConfig, 'stt.appId') as string;
        const apiKey = getValue(draftConfig, 'stt.apiKey') as string;
        const apiSecret = getValue(draftConfig, 'stt.apiSecret') as string;
        if (!appId || !apiKey || !apiSecret) {
          setTestResults(prev => ({ ...prev, [service]: 'fail' }));
          setTestMessages(prev => ({ ...prev, [service]: '请先完整填写讯飞配置' }));
          return;
        }
        const provider = (getValue(draftConfig, 'stt.provider') as string) || 'xfyun-rtasr';
        if (provider === 'xfyun-rtasr') {
          setTestResults(prev => ({ ...prev, [service]: 'ok' }));
          setTestMessages(prev => ({ ...prev, [service]: 'RTASR 需要在实际会话握手中验证；当前仅完成字段完整性检查' }));
          return;
        }
        setTestResults(prev => ({ ...prev, [service]: 'ok' }));
        setTestMessages(prev => ({ ...prev, [service]: '讯飞配置已通过基础检查' }));
      } else if (service === 'translation') {
        const provider = (getValue(draftConfig, 'translation.provider') as string) || 'tencent-tmt';
        const baseUrl = provider === 'tencent-tmt'
          ? 'http://127.0.0.1:8765'
          : (((getValue(draftConfig, 'translation.apiEndpoint') as string) || 'http://127.0.0.1:8765').replace(/\/$/, ''));
        const model = provider === 'tencent-tmt'
          ? 'tencent-tmt'
          : ((getValue(draftConfig, 'translation.model') as string) || 'tencent-tmt');
        if (provider === 'tencent-tmt') {
          let healthPayload: TmtHealthPayload | null = null;
          try {
            const health = await fetch(`${baseUrl}/health`, {
              signal: AbortSignal.timeout(8000),
            });
            healthPayload = await health.json() as TmtHealthPayload;
          } catch {
            setTestResults(prev => ({ ...prev, [service]: 'fail' }));
            setTestMessages(prev => ({ ...prev, [service]: '本地腾讯云 TMT adapter 未启动' }));
            return;
          }
          if (!healthPayload?.ok || healthPayload?.configured === false) {
            const message = healthPayload?.error?.code === 'TMT_CONFIG_MISSING'
              ? '腾讯云 SecretId 或 SecretKey 未配置'
              : (healthPayload?.error?.message || '本地腾讯云 TMT adapter 未启动');
            setTestResults(prev => ({ ...prev, [service]: 'fail' }));
            setTestMessages(prev => ({ ...prev, [service]: message }));
            return;
          }
        }
        const resp = await fetch(`${baseUrl}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'ping',
            targetLanguage: 'zh-CN',
            model,
            context: [],
            constraints: [],
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          setTestResults(prev => ({ ...prev, [service]: 'ok' }));
          setTestMessages(prev => ({ ...prev, [service]: '腾讯云 TMT 连接成功' }));
          return;
        }
        const payload = await resp.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
        let message = payload?.error?.message || 'NMT 连接失败';
        if (payload?.error?.code === 'TMT_AUTH_FAILED') {
          message = '腾讯云鉴权失败，请检查 SecretId / SecretKey / 系统时间';
        } else if (payload?.error?.code === 'TMT_RATE_LIMITED') {
          message = '腾讯云 TMT 触发频率限制，请稍后重试';
        }
        setTestResults(prev => ({ ...prev, [service]: 'fail' }));
        setTestMessages(prev => ({ ...prev, [service]: message }));
      } else if (service === 'llm') {
        const baseUrl = ((getValue(draftConfig, 'llm.apiEndpoint') as string) || 'https://api.deepseek.com').replace(/\/$/, '');
        const apiKey = getValue(draftConfig, 'llm.apiKey') as string;
        if (!apiKey) {
          setTestResults(prev => ({ ...prev, [service]: 'fail' }));
          setTestMessages(prev => ({ ...prev, [service]: '请先填写 LLM API Key' }));
          return;
        }
        const resp = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        setTestResults(prev => ({ ...prev, [service]: resp.ok ? 'ok' : 'fail' }));
        setTestMessages(prev => ({ ...prev, [service]: resp.ok ? 'LLM 连接成功' : 'LLM 连接失败' }));
      } else if (service === 'vector') {
        const baseUrl = (getValue(draftConfig, 'vector.apiEndpoint') as string) || 'https://ark.cn-beijing.volces.com/api/v3';
        const apiKey = getValue(draftConfig, 'vector.apiKey') as string;
        const model = (getValue(draftConfig, 'vector.model') as string) || 'doubao-embedding-vision-251215';
        if (!apiKey) {
          setTestResults(prev => ({ ...prev, [service]: 'fail' }));
          setTestMessages(prev => ({ ...prev, [service]: '请先填写 Embedding Key' }));
          return;
        }
        // 豆包向量模型：直接发一条文本 embedding 请求验证连通性
        const isDoubao = baseUrl.includes('volces.com') || baseUrl.includes('volcengine');
        const endpoint = isDoubao ? `${baseUrl}/embeddings/multimodal` : `${baseUrl}/embeddings`;
        const body = isDoubao
          ? { model, input: [{ type: 'text', text: 'ping' }] }
          : { model, input: ['ping'] };
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(12000),
        });
        setTestResults(prev => ({ ...prev, [service]: resp.ok ? 'ok' : 'fail' }));
        setTestMessages(prev => ({ ...prev, [service]: resp.ok ? '向量模型连接成功' : '向量模型连接失败' }));
      }
    } catch {
      setTestResults(prev => ({ ...prev, [service]: 'fail' }));
      setTestMessages(prev => ({ ...prev, [service]: '连接失败，请检查服务状态和网络' }));
    }
  }, [draftConfig]);

  const fetchModels = useCallback(async (endpointKey: string, target: 'translate' | 'llm' | 'embedding') => {
    const defaultUrl = target === 'embedding'
      ? 'https://ark.cn-beijing.volces.com/api/v3'
      : target === 'llm'
        ? 'https://api.deepseek.com'
        : 'http://127.0.0.1:8765';
    const baseUrl = (getValue(draftConfig, endpointKey) as string) || defaultUrl;
    const apiKeyField = target === 'embedding' ? 'vector.apiKey' : target === 'llm' ? 'llm.apiKey' : 'translation.apiKey';
    const apiKey = getValue(draftConfig, apiKeyField) as string;
    setModelsLoading(true);
    try {
      if (target === 'translate') {
        setTranslateModels(['nmt-default']);
        setModelsLoading(false);
        return;
      }
      // 豆包向量模型不提供 /models 端点，直接给硬编码列表
      const isDoubao = baseUrl.includes('volces.com') || baseUrl.includes('volcengine');
      if (target === 'embedding' && isDoubao) {
        setEmbeddingModels(['doubao-embedding-vision-251215', 'doubao-embedding', 'doubao-embedding-large']);
        setModelsLoading(false);
        return;
      }
      const resp = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { data?: { id: string }[] };
      const names = (data.data || []).map((m: { id: string }) => m.id).sort();
      if (target === 'llm') {
        setLlmModels(names.length > 0 ? names : ['deepseek-v4-flash']);
      } else {
        setEmbeddingModels(names.length > 0 ? names : ['doubao-embedding-vision-251215']);
      }
    } catch (err) {
      if (target === 'llm') {
        setLlmModels(['deepseek-v4-flash', 'deepseek-v4-pro']);
      } else {
        setEmbeddingModels(['doubao-embedding-vision-251215']);
      }
    } finally {
      setModelsLoading(false);
    }
  }, [draftConfig]);

  // 仅更新本地草稿，不提交
  const handleChange = useCallback(
    (key: string, value: string | boolean | number) => {
      const parts = key.split('.');
      if (parts.length >= 2) {
        const finalValue = key === 'stt.language'
          ? toXFyunLang(String(value))
          : key === 'stt.provider'
            ? toSttProvider(String(value))
          : key === 'translation.provider'
            ? toTranslationProvider(String(value))
            : key === 'translation.targetLanguage'
              ? toTranslationTargetLang(String(value))
              : key === 'translation.tencent.sourceLanguage'
                ? toTmtSourceLang(String(value))
                : value;
        setDraftConfig(prev => setDeepValue(prev, key, finalValue));
      }
    },
    [],
  );

  // 点击保存时提交完整草稿
  const handleSaveClick = useCallback(() => {
    onSave(draftConfig);
  }, [onSave, draftConfig]);

  const renderField = (field: SettingField) => {
    const val = getValue(draftConfig, field.key);

    if (field.type === 'toggle') {
      const isOn = !!val;
      return (
        <button
          key={field.key}
          style={{
            ...S.toggle,
            background: isOn ? '#2563eb' : '#4b5563',
            position: 'relative' as const,
            transition: 'background 0.25s ease',
          }}
          onClick={() => handleChange(field.key, !isOn)}
        >
          <span
            style={{
              display: 'inline-block',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#ffffff',
              position: 'absolute',
              top: '3px',
              left: isOn ? '21px' : '3px',
              transition: 'left 0.25s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }}
          />
        </button>
      );
    }

    if (field.type === 'select') {
      const rawVal = getValue(draftConfig, field.key);
      const displayVal = field.key === 'stt.language'
        ? fromXFyunLang(String(rawVal ?? '中文'))
        : field.key === 'stt.provider'
          ? fromSttProvider(String(rawVal ?? 'xfyun-rtasr'))
        : field.key === 'translation.provider'
          ? fromTranslationProvider(String(rawVal ?? 'tencent-tmt'))
          : field.key === 'translation.targetLanguage'
            ? fromTranslationTargetLang(String(rawVal ?? 'zh-CN'))
            : field.key === 'translation.tencent.sourceLanguage'
              ? fromTmtSourceLang(String(rawVal ?? 'auto'))
              : String(rawVal ?? field.options?.[0] ?? '');
      const modelOpts = field.key === 'translation.model'
        ? translateModels
        : field.key === 'llm.model'
          ? llmModels
          : field.key === 'vector.model'
            ? embeddingModels
            : (field.options || []);
      const renderOpts = modelOpts.length > 0 ? modelOpts : (field.defaultValue ? [field.defaultValue] : []);
      return (
        <select
          key={field.key}
          style={S.select}
          value={displayVal}
          onChange={(e) => handleChange(field.key, e.target.value)}
        >
          {(renderOpts).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'button') {
      return (
        <button
          key={field.key}
          style={{ ...S.button, opacity: modelsLoading ? 0.6 : 1 }}
          disabled={modelsLoading}
          onClick={() => {
            if (field.key === 'export') onExportNotes?.();
            else if (field.key === 'clear') onClearData?.();
            else if (field.key === 'translation.fetchModels') fetchModels('translation.apiEndpoint', 'translate');
            else if (field.key === 'llm.fetchModels') fetchModels('llm.apiEndpoint', 'llm');
            else if (field.key === 'vector.fetchModels') fetchModels('vector.apiEndpoint', 'embedding');
          }}
        >
          {modelsLoading && (field.key === 'translation.fetchModels' || field.key === 'llm.fetchModels' || field.key === 'vector.fetchModels') ? '加载中…' : field.label}
        </button>
      );
    }

    if (field.type === 'testButton') {
      const service = (field as any).service as string;
      const testing = testResults[service] === 'testing';
      const result = testResults[service];
      const message = testMessages[service];
      let btnBg = '#111827'; let btnBorder = '1px solid #374151';
      if (result === 'ok') { btnBg = '#065f46'; btnBorder = '1px solid #059669'; }
      if (result === 'fail') { btnBg = '#7f1d1d'; btnBorder = '1px solid #dc2626'; }
      const btnColor = result === 'ok' ? '#6ee7b7' : result === 'fail' ? '#fca5a5' : '#e5e7eb';
      return (
        <div key={field.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <button
            style={{ padding: '6px 14px', borderRadius: '6px', border: btnBorder, background: btnBg, color: btnColor, fontSize: '13px', cursor: 'pointer', opacity: testing ? 0.6 : 1 }}
            disabled={testing}
            onClick={() => runServiceTest(service)}
          >
            {testing ? '测试中…' : result === 'ok' ? '✓ 连接成功' : result === 'fail' ? '✗ 连接失败' : field.label}
          </button>
          {message ? (
            <span style={{ fontSize: '12px', color: result === 'ok' ? '#6ee7b7' : '#fca5a5', maxWidth: '260px', textAlign: 'right' }}>
              {message}
            </span>
          ) : null}
        </div>
      );
    }

    if (field.key === 'note.saveDir') {
      const dirVal = (val as string) || '';
      return (
        <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dirVal || '未设置'}
          </span>
          <button
            style={S.button}
            onClick={async () => {
              const dir = await window.synchrolens.selectDirectory();
              if (dir) handleChange(field.key, dir);
            }}
          >
            浏览…
          </button>
        </div>
      );
    }

    if (field.type === 'number') {
      return (
        <input
          key={field.key}
          style={S.input}
          type="number"
          value={String(val ?? field.defaultValue ?? '')}
          readOnly={field.readOnly}
          onChange={(e) => handleChange(field.key, Number(e.target.value))}
        />
      );
    }

    const placeholder = field.key === 'translation.tencent.secretKey' && getValue(draftConfig, 'translation.tencent.secretKeySaved')
      ? '已保存，留空表示不修改'
      : field.label;
    return (
      <input
        key={field.key}
        style={S.input}
        type={field.type}
        placeholder={placeholder}
        value={String(val ?? field.defaultValue ?? '')}
        readOnly={field.readOnly}
        onChange={(e) => handleChange(field.key, e.target.value)}
      />
    );
  };

  return (
    <div style={S.container}>
      {GROUPS.map((group) => (
        <div key={group.key} style={S.group}>
          <div style={S.groupTitle}>{group.title}</div>
          {group.fields.filter((field) => shouldRenderField(draftConfig, field)).map((field) => (
            <div key={field.key} style={S.field}>
              <span style={S.label}>{field.label}</span>
              {renderField(field)}
            </div>
          ))}
          {group.key === 'stt' ? (
            <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
              IAT is fallback-only for short dictation and may have unstable latency.
            </div>
          ) : null}
        </div>
      ))}
      <button style={S.saveBtn} onClick={handleSaveClick}>💾 保存设置</button>
    </div>
  );
}

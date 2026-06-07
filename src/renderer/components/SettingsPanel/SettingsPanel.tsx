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

function toXFyunLang(displayName: string): string {
  return STT_LANG_MAP[displayName] || 'zh_cn';
}

function fromXFyunLang(code: string): string {
  for (const [name, c] of Object.entries(STT_LANG_MAP)) {
    if (c === code) return name;
  }
  return '中文';
}

/** SettingsPanel 属性 */
interface SettingsPanelProps {
  config: AppConfig;
  onSave: (config: Partial<AppConfig>) => void;
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
  type: 'text' | 'password' | 'select' | 'toggle' | 'number' | 'button';
  options?: string[];
  defaultValue?: string;
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

const GROUPS: SettingGroup[] = [
  {
    key: 'stt',
    title: '🎤 语音识别',
    fields: [
      { key: 'stt.appId', label: 'AppID', type: 'text' },
      { key: 'stt.apiKey', label: 'API Key', type: 'password' },
      { key: 'stt.apiSecret', label: 'API Secret', type: 'password' },
      { key: 'stt.language', label: '识别语言', type: 'select', options: ['中文', '英文', '日文', '韩文'], defaultValue: '中文' },
    ],
  },
  {
    key: 'translation',
    title: '🌐 翻译服务',
    fields: [
      { key: 'translation.provider', label: '服务商', type: 'select', options: ['deepseek', 'openai'] },
      { key: 'translation.apiEndpoint', label: 'API 地址', type: 'text', defaultValue: 'https://api.deepseek.com' },
      { key: 'translation.apiKey', label: 'API Key', type: 'password' },
      { key: 'translation.fetchModels', label: '获取模型', type: 'button' },
      { key: 'translation.model', label: '模型', type: 'select', options: [], defaultValue: 'deepseek-v4-flash' },
      { key: 'translation.contextCorrection', label: '上下文纠正', type: 'toggle' },
      { key: 'translation.contextWindowSize', label: '上下文窗口', type: 'number' },
      { key: 'translation.targetLanguage', label: '目标语言', type: 'select', options: ['中文'] },
    ],
  },
  {
    key: 'vector',
    title: '🧠 向量模型',
    fields: [
      { key: 'translation.apiEndpoint', label: 'API 地址', type: 'text', defaultValue: 'https://api.deepseek.com' },
      { key: 'translation.apiKey', label: 'Embedding Key', type: 'password' },
      { key: 'translation.fetchEmbeddingModels', label: '获取模型', type: 'button' },
      { key: 'translation.embeddingModel', label: 'Embedding 模型', type: 'select', options: [], defaultValue: 'deepseek-v4-flash' },
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
      { key: 'note.autoSave', label: '自动保存', type: 'toggle' },
      { key: 'note.autoSummary', label: '自动总结', type: 'toggle' },
      { key: 'note.summaryThreshold', label: '摘要阈值(句)', type: 'number', defaultValue: '20' },
    ],
  },
  {
    key: 'favorite',
    title: '⭐ 收藏设置',
    fields: [
      { key: 'general.theme', label: '卡片风格', type: 'select', options: ['暗夜蓝', '深空灰', '墨绿'] },
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
  const [embeddingModels, setEmbeddingModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const fetchModels = useCallback(async (endpointKey: string, target: 'translate' | 'embedding') => {
    const baseUrl = (getValue(draftConfig, endpointKey) as string) || 'https://api.deepseek.com/v1';
    setModelsLoading(true);
    try {
      const resp = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${getValue(draftConfig, 'translation.apiKey')}` },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { data?: { id: string }[] };
      const names = (data.data || []).map((m: { id: string }) => m.id).sort();
      if (target === 'translate') {
        setTranslateModels(names);
      } else {
        setEmbeddingModels(names);
      }
    } catch (err) {
      const fallback = ['deepseek-v4-flash', 'deepseek-v4-pro'];
      if (target === 'translate') setTranslateModels(fallback);
      else setEmbeddingModels(fallback);
    } finally {
      setModelsLoading(false);
    }
  }, [draftConfig]);

  // 仅更新本地草稿，不提交
  const handleChange = useCallback(
    (key: string, value: string | boolean | number) => {
      const [section, field] = key.split('.');
      if (section && field) {
        const finalValue = key === 'stt.language' ? toXFyunLang(String(value)) : value;
        setDraftConfig(prev => {
          const next = { ...prev };
          const sectionKey = section as keyof AppConfig;
          if (next[sectionKey] && typeof next[sectionKey] === 'object') {
            (next[sectionKey] as Record<string, unknown>)[field] = finalValue;
          }
          return next;
        });
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
          style={{ ...S.toggle, background: isOn ? '#2563eb' : '#374151' }}
          onClick={() => handleChange(field.key, !isOn)}
        >
          <span style={{ fontSize: 11, marginLeft: isOn ? 18 : 2 }}>●</span>
        </button>
      );
    }

    if (field.type === 'select') {
      const rawVal = getValue(draftConfig, field.key);
      const displayVal = field.key === 'stt.language' ? fromXFyunLang(String(rawVal ?? '中文')) : String(rawVal ?? field.options?.[0] ?? '');
      const modelOpts = field.key === 'translation.model' ? translateModels : (field.key === 'translation.embeddingModel' ? embeddingModels : (field.options || []));
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
            else if (field.key === 'translation.fetchEmbeddingModels') fetchModels('translation.apiEndpoint', 'embedding');
          }}
        >
          {modelsLoading && (field.key === 'translation.fetchModels' || field.key === 'translation.fetchEmbeddingModels') ? '加载中…' : field.label}
        </button>
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
          defaultValue={String(val ?? field.defaultValue ?? '')}
          onChange={(e) => handleChange(field.key, Number(e.target.value))}
        />
      );
    }

    return (
      <input
        key={field.key}
        style={S.input}
        type={field.type}
        placeholder={field.label}
        defaultValue={String(val ?? field.defaultValue ?? '')}
        onChange={(e) => handleChange(field.key, e.target.value)}
      />
    );
  };

  return (
    <div style={S.container}>
      {GROUPS.map((group) => (
        <div key={group.key} style={S.group}>
          <div style={S.groupTitle}>{group.title}</div>
          {group.fields.map((field) => (
            <div key={field.key} style={S.field}>
              <span style={S.label}>{field.label}</span>
              {renderField(field)}
            </div>
          ))}
        </div>
      ))}
      <button style={S.saveBtn} onClick={handleSaveClick}>💾 保存设置</button>
    </div>
  );
}

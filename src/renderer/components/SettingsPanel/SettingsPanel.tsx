/**
 * 设置面板组件
 * 分组设置：语音识别、翻译服务、向量模型、字幕显示、
 * 笔记设置、收藏设置、快捷键、数据管理
 */

import { useState, useCallback } from 'react';
import type { AppConfig } from '@shared/types';

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
      { key: 'stt.provider', label: '服务商', type: 'select', options: ['xfyun', 'whisper-local'] },
      { key: 'stt.appId', label: 'AppID', type: 'text' },
      { key: 'stt.apiKey', label: 'API Key', type: 'password' },
      { key: 'stt.apiSecret', label: 'API Secret', type: 'password' },
      { key: 'stt.language', label: '识别语言', type: 'text', defaultValue: 'zh_cn' },
      { key: 'audio.noiseReduction', label: '降噪', type: 'toggle' },
    ],
  },
  {
    key: 'translation',
    title: '🌐 翻译服务',
    fields: [
      { key: 'translation.provider', label: '服务商', type: 'select', options: ['deepseek', 'openai'] },
      { key: 'translation.apiKey', label: 'API Key', type: 'password' },
      { key: 'translation.model', label: '模型', type: 'text' },
      { key: 'translation.contextCorrection', label: '上下文纠正', type: 'toggle' },
      { key: 'translation.contextWindowSize', label: '上下文窗口', type: 'number' },
      { key: 'translation.targetLanguage', label: '目标语言', type: 'text', defaultValue: 'zh-CN' },
    ],
  },
  {
    key: 'vector',
    title: '🧠 向量模型',
    fields: [
      { key: 'translation.apiKey', label: 'Embedding Key', type: 'password' },
      { key: 'translation.model', label: 'Embedding 模型', type: 'text' },
    ],
  },
  {
    key: 'subtitle',
    title: '💬 字幕显示',
    fields: [
      { key: 'general.language', label: '语言', type: 'select', options: ['zh-CN', 'en-US'] },
      { key: 'general.theme', label: '主题', type: 'select', options: ['light', 'dark', 'system'] },
      { key: 'general.minimizeToTray', label: '最小化到托盘', type: 'toggle' },
      { key: 'general.autoStart', label: '开机自启', type: 'toggle' },
    ],
  },
  {
    key: 'note',
    title: '📝 笔记设置',
    fields: [
      { key: 'note.saveDir', label: '保存目录', type: 'text' },
      { key: 'note.autoSave', label: '自动保存', type: 'toggle' },
      { key: 'note.autoSummary', label: '自动总结', type: 'toggle' },
      { key: 'note.summaryThreshold', label: '摘要阈值(句)', type: 'number', defaultValue: '20' },
    ],
  },
  {
    key: 'favorite',
    title: '⭐ 收藏设置',
    fields: [
      { key: 'general.theme', label: '卡片背景色', type: 'text', defaultValue: '#1f2937' },
      { key: 'general.language', label: '字体色', type: 'text', defaultValue: '#e5e7eb' },
    ],
  },
  {
    key: 'shortcut',
    title: '⌨️ 快捷键',
    fields: [
      { key: 'general.autoStart', label: '开始/停止', type: 'text', defaultValue: 'Ctrl+Shift+S' },
      { key: 'general.minimizeToTray', label: '字幕显隐', type: 'toggle' },
    ],
  },
  {
    key: 'data',
    title: '📦 数据管理',
    fields: [
      { key: 'export', label: '导出全部笔记', type: 'button' },
      { key: 'clear', label: '清除历史数据', type: 'button' },
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
  const [localConfig] = useState({ ...config });

  const handleChange = useCallback(
    (key: string, value: string | boolean | number) => {
      const [section, field] = key.split('.');
      if (section && field) {
        onSave({ [section]: { [field]: value } } as unknown as Partial<AppConfig>);
      }
    },
    [onSave],
  );

  const renderField = (field: SettingField) => {
    const val = getValue(config, field.key);

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
      return (
        <select
          key={field.key}
          style={S.select}
          value={String(val ?? field.options?.[0] ?? '')}
          onChange={(e) => handleChange(field.key, e.target.value)}
        >
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'button') {
      return (
        <button
          key={field.key}
          style={S.button}
          onClick={() => {
            if (field.key === 'export') onExportNotes?.();
            if (field.key === 'clear') onClearData?.();
          }}
        >
          {field.label}
        </button>
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
      <button style={S.saveBtn} onClick={() => onSave({})}>💾 保存设置</button>
    </div>
  );
}

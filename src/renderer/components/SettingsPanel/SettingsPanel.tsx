/**
 * 设置面板组件
 * 分组设置：STT、翻译、字幕、笔记、音频、快捷键
 */

import { useState, useCallback } from 'react';
import type { AppConfig } from '@shared/types';

/** SettingsPanel 属性 */
interface SettingsPanelProps {
  /** 当前配置 */
  config: AppConfig;
  /** 配置变更回调 */
  onSave: (config: Partial<AppConfig>) => void;
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
  type: 'text' | 'password' | 'select' | 'toggle' | 'number';
  options?: string[];
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
    ],
  },
  {
    key: 'subtitle',
    title: '💬 字幕显示',
    fields: [
      { key: 'audio.noiseReduction', label: '降噪', type: 'toggle' },
      { key: 'note.autoSave', label: '自动保存', type: 'toggle' },
      { key: 'note.autoSummary', label: '自动总结', type: 'toggle' },
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
 * 分组管理应用配置
 */
export function SettingsPanel({ config, onSave }: SettingsPanelProps) {
  const [localConfig] = useState({ ...config });

  const handleChange = useCallback(
    (key: string, value: string | boolean) => {
      // 通知父组件配置变更
      const [section, field] = key.split('.');
      if (section && field) {
        onSave({ [section]: { [field]: value } } as unknown as Partial<AppConfig>);
      }
    },
    [onSave],
  );

  return (
    <div style={S.container}>
      {GROUPS.map((group) => (
        <div key={group.key} style={S.group}>
          <div style={S.groupTitle}>{group.title}</div>
          {group.fields.map((field) => (
            <div key={field.key} style={S.field}>
              <span style={S.label}>{field.label}</span>
              {field.type === 'toggle' ? (
                <button
                  style={{
                    ...S.toggle,
                    background: config.audio?.noiseReduction || config.note?.autoSave ? '#2563eb' : '#374151',
                  }}
                  onClick={() => handleChange(field.key, true)}
                >
                  <span style={{ fontSize: 11, marginLeft: config.audio?.noiseReduction || config.note?.autoSave ? 18 : 2 }}>●</span>
                </button>
              ) : field.type === 'select' ? (
                <select
                  style={S.select}
                  defaultValue={field.options?.[0]}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                >
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  style={S.input}
                  type={field.type}
                  placeholder={field.label}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      ))}
      <button style={S.saveBtn} onClick={() => onSave({})}>💾 保存设置</button>
    </div>
  );
}

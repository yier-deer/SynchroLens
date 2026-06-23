import React, { useCallback, useEffect, useState } from 'react';
import { Upload, Trash2, ToggleLeft, ToggleRight, BookOpen, Globe, User } from 'lucide-react';
import type { DictionaryFileInfo, DictType, PersonalDictEntry } from '../../../shared/types';
import { useToast } from '../common/Toast';

type DictTab = 'language' | 'domain' | 'personal';
type FileDictType = Exclude<DictType, 'personal'>;

function toDisplayFile(file: DictionaryFileInfo) {
  return {
    name: file.name,
    path: file.filePath,
    count: file.count,
    enabled: file.enabled,
  };
}

export function DictionaryView(): JSX.Element {
  const [activeTab, setActiveTab] = useState<DictTab>('language');

  const tabs: Array<{ id: DictTab; label: string; icon: React.ReactNode }> = [
    { id: 'language', label: '语言词典', icon: <Globe className="w-4 h-4" /> },
    { id: 'domain', label: '领域词典', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'personal', label: '个人词典', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full flex">
      <div className="w-48 border-r border-surface-800/50 p-3 space-y-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`nav-tab w-full flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'language' && <FileDict type="language" />}
        {activeTab === 'domain' && <FileDict type="domain" />}
        {activeTab === 'personal' && <PersonalDict />}
      </div>
    </div>
  );
}

function FileDict({ type }: { type: FileDictType }): JSX.Element {
  const [files, setFiles] = useState<Array<{ name: string; path: string; count: number; enabled: boolean }>>([]);
  const { showToast } = useToast();

  const loadFiles = useCallback(async () => {
    try {
      const data = await window.synchrolens.listDictionaryFiles(type);
      setFiles(data.map(toDisplayFile));
    } catch {
      setFiles([]);
    }
  }, [type]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleLoadFile = async () => {
    try {
      const filePath = await window.synchrolens.selectFile([
        { name: '词典文件', extensions: ['json', 'csv', 'txt'] },
      ]);
      if (!filePath) return;
      const info = await window.synchrolens.loadDictionaryFile(type, filePath);
      await loadFiles();
      showToast(`词典文件已加载 (${info.count} 条)`);
    } catch {
      showToast('词典文件加载失败', 'error');
    }
  };

  const toggleFile = async (filePath: string, enabled: boolean) => {
    try {
      await window.synchrolens.toggleDictionaryFile(type, filePath, enabled);
      await loadFiles();
    } catch {
      showToast('词典状态更新失败', 'error');
    }
  };

  const removeFile = async (filePath: string) => {
    try {
      await window.synchrolens.removeDictionaryFile(type, filePath);
      await loadFiles();
      showToast('文件已移除');
    } catch {
      showToast('文件移除失败', 'error');
    }
  };

  if (files.length === 0) {
    return <EmptyDictState onLoad={handleLoadFile} type={type} />;
  }

  const icon = type === 'language'
    ? <Globe className="w-5 h-5 text-primary-400" />
    : <BookOpen className="w-5 h-5 text-accent-400" />;
  const label = type === 'language' ? '语言词典' : '领域词典';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-surface-800/50">
        <h3 className="text-sm font-semibold text-surface-200">{label}</h3>
        <button onClick={handleLoadFile} className="btn-primary text-sm flex items-center gap-2">
          <Upload className="w-4 h-4" /> 加载文件
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {files.map((file) => (
          <div key={file.path} className="glass-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${type === 'language' ? 'bg-primary-500/10' : 'bg-accent-500/10'}`}>
                {icon}
              </div>
              <div>
                <p className="text-sm font-medium text-surface-200">{file.name}</p>
                <p className="text-xs text-surface-500">{file.count} 条术语</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label={`${file.enabled ? '禁用' : '启用'} ${file.name}`}
                onClick={() => void toggleFile(file.path, !file.enabled)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  file.enabled ? 'text-green-400 hover:bg-green-500/10' : 'text-surface-500 hover:bg-surface-700'
                }`}
              >
                {file.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button
                aria-label={`删除 ${file.name}`}
                onClick={() => void removeFile(file.path)}
                className="p-2 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PersonalDict(): JSX.Element {
  const [entries, setEntries] = useState<PersonalDictEntry[]>([]);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  const loadEntries = useCallback(async () => {
    try {
      const data = await window.synchrolens.getDictionaryEntries('personal');
      setEntries(data as PersonalDictEntry[]);
    } catch {
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDelete = async () => {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => window.synchrolens.removeDictionaryEntry('personal', id)));
      setSelectedIds(new Set());
      await loadEntries();
      showToast('已删除选中项');
    } catch {
      showToast('删除失败', 'error');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-surface-800/50">
        <h3 className="text-sm font-semibold text-surface-200">个人词典</h3>
        <button
          onClick={() => {
            setIsManageMode(!isManageMode);
            setSelectedIds(new Set());
          }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            isManageMode
              ? 'bg-primary-500/20 text-primary-400'
              : 'bg-surface-800/50 text-surface-400 hover:bg-surface-700'
          }`}
        >
          {isManageMode ? '完成' : '管理'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {entries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-800/50 flex items-center justify-center mb-4">
              <User className="w-7 h-7 text-surface-500" />
            </div>
            <h3 className="text-base font-medium text-surface-300 mb-1">个人词典为空</h3>
            <p className="text-sm text-surface-500">通过「改进」操作自动收录</p>
          </div>
        ) : (
          <div className="border border-surface-800/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-800/50 text-surface-400">
                <tr>
                  {isManageMode && <th className="px-4 py-2 text-left w-10">选择</th>}
                  <th className="px-4 py-2 text-left">原文</th>
                  <th className="px-4 py-2 text-left">改进译文</th>
                  <th className="px-4 py-2 text-left">改进意见</th>
                  <th className="px-4 py-2 text-left">来源笔记</th>
                  <th className="px-4 py-2 text-left">时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800/50">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className={`hover:bg-surface-800/30 transition-colors ${
                      selectedIds.has(entry.id) ? 'bg-primary-500/5' : ''
                    }`}
                    onClick={() => isManageMode && toggleSelection(entry.id)}
                  >
                    {isManageMode && (
                      <td className="px-4 py-3">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                          selectedIds.has(entry.id) ? 'bg-primary-500 border-primary-500' : 'border-surface-600'
                        }`}>
                          {selectedIds.has(entry.id) && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-surface-200">{entry.source}</td>
                    <td className="px-4 py-3 text-surface-200">{entry.target}</td>
                    <td className="px-4 py-3 text-surface-400 max-w-xs truncate" title={entry.improvement}>
                      {entry.improvement.length > 30 ? `${entry.improvement.slice(0, 30)}...` : entry.improvement}
                    </td>
                    <td className="px-4 py-3 text-surface-400">{entry.sourceNote || '-'}</td>
                    <td className="px-4 py-3 text-surface-500 text-xs">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isManageMode && (
        <div className="p-4 border-t border-surface-800/50 bg-surface-900/80 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm text-surface-400">已选择 {selectedIds.size} 项</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsManageMode(false);
                  setSelectedIds(new Set());
                }}
                className="btn-secondary text-sm"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                删除选中
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyDictState({ onLoad, type }: { onLoad: () => void; type: FileDictType }): JSX.Element {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-surface-800/50 flex items-center justify-center mb-4 animate-float">
        <Upload className="w-8 h-8 text-surface-500" />
      </div>
      <h3 className="text-base font-medium text-surface-300 mb-2">
        尚未加载任何{type === 'language' ? '语言' : '领域'}词典
      </h3>
      <p className="text-sm text-surface-500 mb-6 max-w-sm">
        支持 .json / .csv / .txt 格式的术语表文件
      </p>
      <button onClick={onLoad} className="btn-primary text-sm flex items-center gap-2">
        <Upload className="w-4 h-4" /> 选择文件
      </button>
    </div>
  );
}

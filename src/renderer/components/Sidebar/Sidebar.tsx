import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Star, BookOpen, Settings, Radio, ChevronRight, ChevronDown, Folder, File } from 'lucide-react';
import type { NoteTreeItem } from '@shared/types';

export type ViewType = 'notes' | 'favorites' | 'dictionary' | 'settings';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  onNoteSelect: (note: NoteTreeItem) => void;
  isRecording: boolean;
  onPrepareRecord: () => void;
  lastViewedNotePath?: string | null;
  /** 每次递增触发重新加载笔记树 */
  refreshNotes?: number;
}

export function Sidebar({ activeView, onViewChange, onNoteSelect, isRecording, onPrepareRecord, lastViewedNotePath, refreshNotes }: SidebarProps): JSX.Element {
  const [noteTree, setNoteTree] = useState<NoteTreeItem[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadNotes();
  }, [refreshNotes]);

  const loadNotes = async () => {
    try {
      const tree = await window.synchrolens.listNotes();
      setNoteTree(tree as NoteTreeItem[]);
    } catch {
      setNoteTree([]);
    }
  };

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const menuItems: Array<{ id: ViewType; label: string; icon: React.ReactNode }> = [
    { id: 'notes', label: '笔记', icon: <FileText className="w-5 h-5" /> },
    { id: 'favorites', label: '收藏', icon: <Star className="w-5 h-5" /> },
    { id: 'dictionary', label: '词典', icon: <BookOpen className="w-5 h-5" /> },
    { id: 'settings', label: '设置', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="h-full flex flex-col bg-surface-950/50">
      <div className="p-4 border-b border-surface-800/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-500/20 flex items-center justify-center">
            <Radio className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-surface-100 tracking-tight">SynchroLens</h1>
            <p className="text-[10px] text-surface-500 uppercase tracking-widest">AI 同声传译</p>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-1">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => {
              // 笔记按钮三种状态行为
              if (item.id === 'notes') {
                if (isRecording) {
                  onViewChange('notes');
                } else if (lastViewedNotePath && noteTree.length > 0) {
                  const findNote = (items: NoteTreeItem[]): NoteTreeItem | null => {
                    for (const it of items) {
                      if (it.type === 'file' && it.path === lastViewedNotePath) return it;
                      if (it.children) { const f = findNote(it.children); if (f) return f; }
                    }
                    return null;
                  };
                  const lastNote = findNote(noteTree);
                  if (lastNote) { onNoteSelect(lastNote); return; }
                }
              }
              onViewChange(item.id);
            }}
            className={`sidebar-item w-full ${activeView === item.id ? 'active' : ''}`}
          >
            {item.icon}
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}

        <button
          onClick={onPrepareRecord}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 mt-2 ${
            isRecording
              ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
              : 'bg-primary-500/10 text-primary-400 border border-primary-500/20 hover:bg-primary-500/20'
          }`}
        >
          <Radio className={`w-5 h-5 ${isRecording ? 'animate-pulse' : ''}`} />
          <span>{isRecording ? '停止录制' : '准备录制'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-2 px-3">
          历史笔记
        </h3>
        <div className="space-y-0.5">
          {noteTree.map(item => (
            <TreeNode
              key={item.path}
              item={item}
              expandedDirs={expandedDirs}
              onToggleDir={toggleDir}
              onNoteSelect={onNoteSelect}
              level={0}
            />
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-surface-800/50">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-green-500 animate-pulse' : 'bg-surface-600'}`} />
          <span className="text-xs text-surface-500">
            {isRecording ? '录制中' : '就绪'}
          </span>
        </div>
      </div>
    </div>
  );
}

function TreeNode({
  item,
  expandedDirs,
  onToggleDir,
  onNoteSelect,
  level
}: {
  item: NoteTreeItem;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
  onNoteSelect: (note: NoteTreeItem) => void;
  level: number;
}): JSX.Element {
  const isExpanded = expandedDirs.has(item.path);

  if (item.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => onToggleDir(item.path)}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-surface-400 hover:bg-surface-800/50 hover:text-surface-200 transition-all duration-200"
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-surface-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-surface-500" />
          )}
          <Folder className="w-4 h-4 text-primary-400/70" />
          <span className="text-sm">{item.name}</span>
        </button>
        {isExpanded && item.children && (
          <div className="mt-0.5">
            {item.children.map((child: NoteTreeItem) => (
              <TreeNode
                key={child.path}
                item={child}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
                onNoteSelect={onNoteSelect}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onNoteSelect(item)}
      className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-surface-400 hover:bg-surface-800/50 hover:text-surface-200 transition-all duration-200"
      style={{ paddingLeft: `${12 + level * 16}px` }}
    >
      <File className="w-4 h-4 text-surface-500" />
      <span className="text-sm truncate">{item.name}</span>
    </button>
  );
}

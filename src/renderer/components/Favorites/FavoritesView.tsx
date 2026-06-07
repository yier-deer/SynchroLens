import React, { useState, useEffect, useCallback } from 'react';
import { Search, Trash2, X, Check, FileText } from 'lucide-react';
import type { Favorite } from '../../../shared/types';
import { useToast } from '../common/Toast';

interface FavoritesViewProps {
  onNavigateToNote?: (notePath: string) => void;
  cardStyle?: string;
}

export function FavoritesView({ onNavigateToNote, cardStyle = '暗夜蓝' }: FavoritesViewProps): JSX.Element {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const data = await window.synchrolens.getFavorites();
      setFavorites(data as Favorite[]);
    } catch {
      setFavorites([]);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadFavorites();
      return;
    }
    try {
      const results = await window.synchrolens.searchFavorites(searchQuery);
      setFavorites(results as Favorite[]);
    } catch {
      setFavorites([]);
    }
  };

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === favorites.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(favorites.map(f => f.id)));
    }
  }, [favorites, selectedIds]);

  const handleDelete = async () => {
    const ids = Array.from(selectedIds);
    await window.synchrolens.removeFavorites(ids);
    setSelectedIds(new Set());
    loadFavorites();
    showToast('已删除选中项');
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-primary-500/30 text-primary-200 rounded px-0.5">{part}</mark> : part
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-surface-800/50">
        <h2 className="text-base font-semibold text-surface-100">收藏</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-surface-800/50 rounded-lg px-3 py-1.5">
            <Search className="w-4 h-4 text-surface-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="bg-transparent text-sm text-surface-200 placeholder-surface-500 outline-none w-40"
              placeholder="搜索收藏..."
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); loadFavorites(); }} aria-label="清除搜索">
                <X className="w-3.5 h-3.5 text-surface-500 hover:text-surface-300" />
              </button>
            )}
          </div>
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
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {favorites.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-800/50 flex items-center justify-center mb-4">
              <FileText className="w-7 h-7 text-surface-500" />
            </div>
            <h3 className="text-base font-medium text-surface-300 mb-1">暂无收藏</h3>
            <p className="text-sm text-surface-500">在阅读笔记时选中文字并收藏</p>
          </div>
        ) : (
          <div className="space-y-3">
            {favorites.map(favorite => (
              <div
                key={favorite.id}
                className={`glass-card p-4 transition-all duration-200 ${
                  isManageMode ? 'cursor-pointer' : ''
                } ${selectedIds.has(favorite.id) ? 'border-primary-500/30 bg-primary-500/5' : ''} ${
                  cardStyle === '暗夜蓝' ? 'fav-card-nightblue' : cardStyle === '深空灰' ? 'fav-card-spacegray' : 'fav-card-forestgreen'
                }`}
                onClick={() => isManageMode && toggleSelection(favorite.id)}
              >
                <div className="flex items-start gap-3">
                  {isManageMode && (
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-all duration-200 ${
                      selectedIds.has(favorite.id)
                        ? 'bg-primary-500 border-primary-500'
                        : 'border-surface-600'
                    }`}>
                      {selectedIds.has(favorite.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm text-surface-200 leading-relaxed mb-2">
                      {highlightText(favorite.text, searchQuery)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-surface-500">
                      <FileText className="w-3.5 h-3.5" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (favorite.noteFilePath && onNavigateToNote) {
                            onNavigateToNote(favorite.noteFilePath);
                          }
                        }}
                        className="text-primary-400 hover:text-primary-300 hover:underline transition-colors cursor-pointer"
                        title={`跳转到笔记: ${favorite.noteFileName}`}
                      >
                        {favorite.noteFileName}
                      </button>
                      <span className="text-surface-700">·</span>
                      <span>{new Date(favorite.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isManageMode && (
        <div className="p-4 border-t border-surface-800/50 bg-surface-900/80 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <button
              onClick={selectAll}
              className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
            >
              {selectedIds.size === favorites.length ? '取消全选' : '全选'}
            </button>
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

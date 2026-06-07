import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Copy, Wand2, X, Check } from 'lucide-react';
import type { NoteTreeItem, TranslationResult } from '../../../shared/types';
import { useToast } from '../common/Toast';

interface NotesViewProps {
  selectedNote: NoteTreeItem | null;
  onClearSelection: () => void;
  /** 摘要提取回调（来自 HTML 注释标记） */
  onSummaryExtracted?: (summary: string) => void;
  /** 快速开始回调 */
  onQuickStart?: () => void;
}

export function NotesView({ selectedNote, onClearSelection, onSummaryExtracted, onQuickStart }: NotesViewProps): JSX.Element {
  const [sessionState, setSessionState] = useState<'idle' | 'running' | 'stopped'>('idle');
  const [sentences, setSentences] = useState<TranslationResult[]>([]);
  const [currentSentence, setCurrentSentence] = useState<TranslationResult | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showImprovePanel, setShowImprovePanel] = useState(false);
  const [improveData, setImproveData] = useState({ original: '', improved: '', reason: '' });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribeState = window.synchrolens.on('session:state-change', (data: unknown) => {
      const payload = data as { state: string };
      setSessionState(payload.state as 'idle' | 'running' | 'stopped');
    });

    const unsubscribePartial = window.synchrolens.on('translate:partial', (data: unknown) => {
      const payload = data as { sentenceId: string; translation: string };
      setCurrentSentence({
        sentenceId: payload.sentenceId,
        original: '',
        translation: payload.translation,
        isFinal: false,
        corrections: [],
      });
    });

    const unsubscribeFinal = window.synchrolens.on('translate:final', (data: unknown) => {
      const payload = data as TranslationResult;
      setCurrentSentence(null);
      setSentences(prev => [...prev, payload]);
    });

    return () => {
      unsubscribeState();
      unsubscribePartial();
      unsubscribeFinal();
    };
  }, []);

  useEffect(() => {
    if (selectedNote) {
      window.synchrolens.readNote(selectedNote.path).then(content => {
        // 提取摘要（HTML注释标记）并从显示内容中移除
        const summaryMatch = content.match(/<!--\s*summary\s*-->([\s\S]*?)<!--\s*\/summary\s*-->/);
        if (summaryMatch) {
          const extracted = summaryMatch[1].trim();
          onSummaryExtracted?.(extracted);
          setNoteContent(content.replace(/<!--\s*summary\s*-->[\s\S]*?<!--\s*\/summary\s*-->/g, '').trim());
        } else {
          onSummaryExtracted?.('');
          setNoteContent(content);
        }
      });
    }
  }, [selectedNote]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sentences, currentSentence]);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';
    setSelectedText(text || '');
  }, []);

  // 全局点击关闭右键菜单
  useEffect(() => {
    const closeMenu = () => { setShowContextMenu(false); setSelectedText(''); };
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // 仅在笔记阅读区域（selectedNote非空）显示完整右键菜单
    if (selectedNote && selectedText) {
      e.preventDefault();
      setContextMenuPos({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
    }
    // 非笔记阅读区域：保留浏览器默认右键（仅复制）
  }, [selectedText, selectedNote]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(selectedText);
    showToast('已复制');
    setShowContextMenu(false);
    setSelectedText('');
  }, [selectedText, showToast]);

  const handleFavorite = useCallback(async () => {
    if (selectedNote) {
      await window.synchrolens.addFavorite(selectedText, selectedNote.name, selectedNote.path);
      showToast('已收藏');
    }
    setShowContextMenu(false);
    setSelectedText('');
  }, [selectedText, selectedNote, showToast]);

  const handleImprove = useCallback(() => {
    setImproveData({ original: selectedText, improved: '', reason: '' });
    setShowImprovePanel(true);
    setShowContextMenu(false);
  }, [selectedText]);

  const handleSubmitImprove = useCallback(async () => {
    // 检查向量模型是否配置
    try {
      const isEnabled = await window.synchrolens.isPersonalDictEnabled();
      if (!isEnabled) {
        window.alert('向量模型密钥未配置，请先在「设置」→「向量模型」中配置 Embedding Key，以便改进翻译能被向量化存储。');
        return;
      }
    } catch {
      // 检测失败不阻断流程
    }
    await window.synchrolens.submitImprovement(
      improveData.original,
      improveData.improved,
      improveData.reason,
      selectedNote?.path || ''
    );
    setShowImprovePanel(false);
    setShowSuccessModal(true);
  }, [improveData, selectedNote]);

  if (selectedNote) {
    return (
      <div className="h-full flex flex-col" ref={contentRef}>
        <div className="flex items-center gap-3 p-4 border-b border-surface-800/50">
          <button
            onClick={onClearSelection}
            className="p-2 rounded-lg bg-surface-800/50 text-surface-400 hover:bg-surface-700 hover:text-surface-200 transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-surface-200">{selectedNote.name}</h2>
            <p className="text-xs text-surface-500">{selectedNote.path}</p>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto p-6"
          onMouseUp={handleTextSelection}
          onContextMenu={handleContextMenu}
        >
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {noteContent}
            </ReactMarkdown>
          </div>
        </div>

        {showContextMenu && (
          <div
            className="fixed z-50 bg-surface-800 border border-surface-700 rounded-lg shadow-xl py-1 min-w-[140px] animate-fade-in"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button onClick={handleCopy} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-surface-200 hover:bg-surface-700 transition-colors">
              <Copy className="w-4 h-4" /> 复制
            </button>
            <button onClick={handleFavorite} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-surface-200 hover:bg-surface-700 transition-colors">
              <Copy className="w-4 h-4" /> 收藏
            </button>
            <button onClick={handleImprove} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-surface-200 hover:bg-surface-700 transition-colors">
              <Wand2 className="w-4 h-4" /> 改进
            </button>
          </div>
        )}

        {showImprovePanel && (
          <ImprovePanel
            data={improveData}
            onChange={setImproveData}
            onSubmit={handleSubmitImprove}
            onClose={() => setShowImprovePanel(false)}
          />
        )}

        {showSuccessModal && (
          <SuccessModal onClose={() => setShowSuccessModal(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-surface-800/50">
        <div className="flex items-center gap-3">
          {sessionState === 'running' && (
            <div className="recording-indicator" />
          )}
          <h2 className="text-sm font-semibold text-surface-200">
            {sessionState === 'running' ? '笔记' : sessionState === 'stopped' ? '笔记' : '笔记'}
          </h2>
        </div>
        {sessionState === 'running' && (
          <span className="text-xs text-green-400/80 animate-pulse">录制中</span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {sentences.length === 0 && sessionState === 'idle' ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-800/50 flex items-center justify-center mb-4 animate-float">
              <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h3 className="text-base font-medium text-surface-300 mb-2">准备录制你的会议</h3>
            <p className="text-sm text-surface-500 mb-6 max-w-xs">
              点击左侧「准备录制」按钮，启动同声传译功能
            </p>
            <button className="btn-primary text-sm" onClick={onQuickStart}>快速开始</button>
          </div>
        ) : (
          <>
            {sentences.map(sentence => (
              <div
                key={sentence.sentenceId}
                className="glass-card p-3 animate-fade-in"
              >
                <p className="text-xs text-surface-500 mb-1">{sentence.original}</p>
                <p className="text-sm text-surface-200">{sentence.translation}</p>
                {sentence.corrections && sentence.corrections.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-surface-700/30">
                    {sentence.corrections.map((corr, idx) => (
                      <p key={idx} className="text-xs text-primary-400/80">
                        已修正: {corr.from} → {corr.to}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {currentSentence && (
              <div className="glass-card p-3 border-primary-500/20">
                <p className="text-sm text-primary-400">
                  {currentSentence.translation}
                  <span className="inline-block w-0.5 h-4 bg-primary-400 ml-1 animate-cursor-blink align-middle" />
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ImprovePanel({
  data,
  onChange,
  onSubmit,
  onClose
}: {
  data: { original: string; improved: string; reason: string };
  onChange: (data: { original: string; improved: string; reason: string }) => void;
  onSubmit: () => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
      <div className="bg-surface-900 border-t border-surface-700 rounded-t-2xl shadow-2xl px-6 py-5 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-surface-100">改进翻译</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-700 text-surface-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-400 mb-1.5 block">请输入改进后的译文</label>
            <textarea
              value={data.improved}
              onChange={e => onChange({ ...data, improved: e.target.value })}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-4 py-3 text-sm text-surface-100 placeholder-surface-500 resize-none focus:outline-none focus:border-primary-500/50 transition-colors"
              placeholder="输入改进后的翻译..."
              rows={3}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-400 mb-1.5 block">请输入改进建议</label>
            <textarea
              value={data.reason}
              onChange={e => onChange({ ...data, reason: e.target.value })}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg px-4 py-3 text-sm text-surface-100 placeholder-surface-500 resize-none focus:outline-none focus:border-primary-500/50 transition-colors"
              placeholder="说明改进原因，如术语偏好、表达风格等..."
              rows={3}
            />
          </div>
          <div className="flex justify-end pt-1">
            <button onClick={onSubmit} className="btn-primary text-sm px-6 py-2.5">
              确认改进
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-panel p-6 w-80 animate-slide-up text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="w-6 h-6 text-green-400" />
        </div>
        <h3 className="text-base font-semibold text-surface-100 mb-2">Yes, sir!</h3>
        <p className="text-sm text-surface-400 mb-4">我会变得越来越懂你!</p>
        <button onClick={onClose} className="btn-primary text-sm w-full">
          确定
        </button>
      </div>
    </div>
  );
}

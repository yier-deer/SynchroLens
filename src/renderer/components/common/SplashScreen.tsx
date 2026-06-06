import React, { useState, useEffect } from 'react';
import { Radio, Zap, Globe, Brain, Sparkles } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps): JSX.Element {
  const [progress, setProgress] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setFadeOut(true);
            setTimeout(onComplete, 500);
          }, 300);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [onComplete]);

  const features = [
    { icon: <Globe className="w-4 h-4" />, text: '多语言支持' },
    { icon: <Brain className="w-4 h-4" />, text: 'AI 智能翻译' },
    { icon: <Zap className="w-4 h-4" />, text: '实时字幕' },
    { icon: <Sparkles className="w-4 h-4" />, text: '自动纠错' }
  ];

  return (
    <div className={`fixed inset-0 z-[100] bg-surface-950 flex flex-col items-center justify-center transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-2xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center animate-glow">
          <Radio className="w-12 h-12 text-primary-400" />
        </div>
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent-500/80 flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
      </div>

      <h1 className="text-3xl font-bold text-surface-100 mb-2 tracking-tight">
        Synchro<span className="text-primary-400">Lens</span>
      </h1>
      <p className="text-sm text-surface-500 mb-12">AI 同声传译助手</p>

      <div className="flex items-center gap-4 mb-12">
        {features.map((feature, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-800/50 border border-surface-700/30 text-xs text-surface-400"
            style={{ animationDelay: `${index * 0.2}s` }}
          >
            {feature.icon}
            <span>{feature.text}</span>
          </div>
        ))}
      </div>

      <div className="w-64 h-1 bg-surface-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="text-xs text-surface-600 mt-3">
        {progress < 100 ? '正在初始化...' : '准备就绪'}
      </p>
    </div>
  );
}

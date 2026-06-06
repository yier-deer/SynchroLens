import React from 'react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  confirmVariant = 'primary',
  onConfirm,
  onCancel
}: ConfirmDialogProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel p-6 w-80 animate-slide-up">
        <h3 className="text-lg font-semibold text-surface-100 mb-2">{title}</h3>
        <p className="text-sm text-surface-400 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary text-sm">
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={confirmVariant === 'danger' ? 'btn-danger text-sm' : 'btn-primary text-sm'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface InputDialogProps {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({
  title,
  placeholder,
  defaultValue = '',
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel
}: InputDialogProps): JSX.Element {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel p-6 w-80 animate-slide-up">
        <h3 className="text-lg font-semibold text-surface-100 mb-4">{title}</h3>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          className="input-field text-sm mb-4"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') onConfirm(value);
            if (e.key === 'Escape') onCancel();
          }}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary text-sm">
            {cancelText}
          </button>
          <button onClick={() => onConfirm(value)} className="btn-primary text-sm">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, position = 'top' }: TooltipProps): JSX.Element {
  const [show, setShow] = React.useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className={`absolute z-50 px-2 py-1 bg-surface-800 text-surface-200 text-xs rounded-lg shadow-xl whitespace-nowrap animate-fade-in ${positionClasses[position]}`}>
          {content}
          <div className={`absolute w-2 h-2 bg-surface-800 rotate-45 ${
            position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1' :
            position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1' :
            position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1' :
            'right-full top-1/2 -translate-y-1/2 -mr-1'
          }`} />
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}): JSX.Element {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-surface-800/50 flex items-center justify-center mb-4 animate-float">
        {icon}
      </div>
      <h3 className="text-base font-medium text-surface-300 mb-2">{title}</h3>
      <p className="text-sm text-surface-500 mb-6 max-w-sm">{description}</p>
      {action}
    </div>
  );
}

export function Badge({
  children,
  variant = 'default'
}: {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}): JSX.Element {
  const variantClasses = {
    default: 'bg-surface-800 text-surface-400',
    primary: 'bg-primary-500/10 text-primary-400 border border-primary-500/20',
    success: 'bg-green-500/10 text-green-400 border border-green-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20'
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  );
}

export function Skeleton({ className = '' }: { className?: string }): JSX.Element {
  return (
    <div className={`animate-pulse bg-surface-800/50 rounded-lg ${className}`} />
  );
}

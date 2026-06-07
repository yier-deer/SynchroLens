// Mock for lucide-react icons in tests
import React from 'react';

interface IconProps {
  className?: string;
  size?: number | string;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}

const createIcon = (name: string) => {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>((props, ref) =>
    React.createElement('svg', { ref, 'data-testid': `icon-${name}`, ...props })
  );
  Icon.displayName = name;
  return Icon;
};

// Generate all possible icons via Proxy
const handler: ProxyHandler<Record<string, unknown>> = {
  get(_target, prop) {
    if (typeof prop === 'string' && prop !== '$$typeof') {
      return createIcon(prop);
    }
    return undefined;
  },
};

// Use Proxy for dynamic access, plus explicit named exports for direct import
const moduleExports = new Proxy({
  Search: createIcon('search'),
  Trash2: createIcon('trash2'),
  X: createIcon('x'),
  Check: createIcon('check'),
  FileText: createIcon('file-text'),
  Copy: createIcon('copy'),
  Wand2: createIcon('wand2'),
  ArrowLeft: createIcon('arrow-left'),
  Star: createIcon('star'),
  BookOpen: createIcon('book-open'),
  Settings: createIcon('settings'),
  Radio: createIcon('radio'),
  Upload: createIcon('upload'),
  ToggleLeft: createIcon('toggle-left'),
  ToggleRight: createIcon('toggle-right'),
  Globe: createIcon('globe'),
  User: createIcon('user'),
  ChevronRight: createIcon('chevron-right'),
  ChevronDown: createIcon('chevron-down'),
  Folder: createIcon('folder'),
  File: createIcon('file'),
  Download: createIcon('download'),
}, handler);

export = moduleExports;

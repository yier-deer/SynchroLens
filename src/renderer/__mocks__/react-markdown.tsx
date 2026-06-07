import { type ReactNode } from 'react';

interface ReactMarkdownProps {
  children?: string;
  remarkPlugins?: unknown[];
  className?: string;
}

export default function ReactMarkdown({ children }: ReactMarkdownProps): ReactNode {
  return children || null;
}

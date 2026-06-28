"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { extractDocCitations, normalizeAgentMarkdown } from "@/lib/agent-markdown";
import { AgentDocCitations } from "./AgentDocCitations";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h3 className="agent-md-heading mt-5 mb-2 text-base font-semibold first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="agent-md-heading mt-4 mb-2 text-[15px] font-semibold text-[var(--color-accent-glow)] first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="agent-md-heading mt-3 mb-1.5 text-sm font-semibold first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="agent-md-p">{children}</p>,
  ul: ({ children }) => (
    <ul className="agent-md-list mb-3 space-y-2 border-l-2 border-[var(--color-accent)]/35 pl-4">{children}</ul>
  ),
  ol: ({ children }) => <ol className="agent-md-list mb-3 list-decimal space-y-2 pl-5">{children}</ol>,
  li: ({ children }) => <li className="agent-md-li">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-[var(--color-foreground)]">{children}</strong>
  ),
  em: ({ children }) => <em className="text-[var(--color-foreground-muted)] italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 rounded-r-lg border-l-2 border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5 py-2 pl-4 pr-2 text-sm italic text-[var(--color-muted)]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-[var(--color-border)]" />,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-[var(--color-accent-glow)] underline-offset-2 hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <pre className="my-3 overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]/80 p-3">
          <code className="font-mono text-xs leading-relaxed text-[var(--color-foreground-muted)]">{children}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-[var(--color-border)]/70 px-1.5 py-0.5 font-mono text-[12px] text-[var(--color-accent-glow)]">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full min-w-[280px] text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[var(--color-card-hover)] text-xs uppercase">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-[var(--color-border)] px-3 py-2 font-medium text-[var(--color-foreground)]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-[var(--color-border)]/60 px-3 py-2 text-[var(--color-foreground-muted)]">
      {children}
    </td>
  ),
};

export function AgentMarkdown({
  content,
  extraCitations,
  streaming,
}: {
  content: string;
  extraCitations?: string[];
  streaming?: boolean;
}) {
  if (!content?.trim()) return null;

  const citations = [...new Set([...extractDocCitations(content), ...(extraCitations ?? [])])];
  const normalized = normalizeAgentMarkdown(content, { streaming });

  return (
    <div className="agent-markdown min-w-0 w-full">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {normalized}
      </ReactMarkdown>
      <AgentDocCitations titles={citations} />
    </div>
  );
}

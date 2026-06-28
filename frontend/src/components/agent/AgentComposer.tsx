"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Square, Paperclip } from "lucide-react";

type Props = {
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  onAttach?: () => void;
  loading: boolean;
  disabled?: boolean;
  placeholder?: string;
  showAttach?: boolean;
};

export function AgentComposer({
  input,
  onInputChange,
  onSubmit,
  onStop,
  onAttach,
  loading,
  disabled,
  placeholder = "Pergunte sobre cluster, Argo, métricas, logs ou runbooks… (Enter envia, Shift+Enter nova linha)",
  showAttach = false,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading && input.trim()) onSubmit();
    }
  }

  return (
    <form
      className="border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 pb-4 md:px-5 lg:px-6 md:pb-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading) onSubmit();
      }}
    >
      <div className="flex w-full items-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-2">
        {showAttach ? (
          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onAttach} disabled={loading}>
            <Paperclip className="h-4 w-4" />
          </Button>
        ) : null}
        <textarea
          ref={textareaRef}
          rows={1}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[var(--color-muted)]"
          placeholder={placeholder}
          value={input}
          onChange={(e) => {
            onInputChange(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled || loading}
          aria-label="Mensagem para o agente"
        />
        {loading ? (
          <Button type="button" size="icon" variant="outline" className="shrink-0" onClick={onStop} aria-label="Parar">
            <Square className="h-4 w-4 fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={disabled || !input.trim()} className="shrink-0" aria-label="Enviar">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}

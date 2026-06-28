"use client";

import {
  type LlmProviderId,
  type ModelOption,
  MODEL_CATALOG,
  formatUsdPer1M,
  tierLabel,
} from "@/lib/llm-models";
import { cn } from "@/lib/utils";

type Props = {
  provider: LlmProviderId;
  selectedModelId: string;
  onSelect: (model: ModelOption) => void;
};

export function ModelCatalog({ provider, selectedModelId, onSelect }: Props) {
  const models = MODEL_CATALOG.filter((m) => m.provider === provider);

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--color-muted)]">
        Preços de referência (USD / 1M tokens). Confira valores atuais no site do provedor antes de decidir.
      </p>
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="bg-[var(--color-card)] text-[var(--color-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Modelo</th>
              <th className="px-3 py-2 font-medium">Entrada</th>
              <th className="px-3 py-2 font-medium">Saída</th>
              <th className="px-3 py-2 font-medium">Contexto</th>
              <th className="px-3 py-2 font-medium">Perfil</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const selected = m.id === selectedModelId;
              return (
                <tr
                  key={m.id}
                  className={cn(
                    "border-t border-[var(--color-border)] transition-colors",
                    selected ? "bg-[var(--color-accent)]/10" : "hover:bg-[var(--color-card-hover)]"
                  )}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-[var(--color-foreground)]">{m.label}</p>
                    <p className="text-[10px] text-[var(--color-muted)]">{m.id}</p>
                    <p className="mt-1 text-[10px] text-[var(--color-foreground-muted)]">{m.description}</p>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatUsdPer1M(m.inputUsdPer1M)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatUsdPer1M(m.outputUsdPer1M)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{m.contextK}k</td>
                  <td className="px-3 py-2 whitespace-nowrap">{tierLabel(m.tier)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSelect(m)}
                      className={cn(
                        "rounded px-2 py-1 text-[10px] font-medium",
                        selected
                          ? "bg-[var(--color-accent)] text-white"
                          : "border border-[var(--color-border)] hover:border-[var(--color-accent)]"
                      )}
                    >
                      {selected ? "Selecionado" : "Usar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

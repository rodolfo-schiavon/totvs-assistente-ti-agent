"use client";

import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { formatCostUsd, formatTokenCount } from "@/lib/token-usage";

export type ConversationRow = {
  conversationId: string;
  title?: string | null;
  userId: string;
  department?: string | null;
  userRole?: string | null;
  tenantLabel?: string;
  messageCount: number;
  totalTokens: number;
  estimatedCostUsd: number;
  primaryModel?: string | null;
  ragUsed: boolean;
  negativeFeedback: boolean;
  riskLevel: string;
  lastActivityAt: string;
  status: string;
};

export function ConversationDataGrid({ rows }: { rows: ConversationRow[] }) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([{ id: "lastActivityAt", desc: true }]);

  function openConversation(conversationId: string) {
    router.push(`/dashboard/admin/conversations/${conversationId}`);
  }

  const columns = useMemo<ColumnDef<ConversationRow>[]>(
    () => [
      {
        accessorKey: "lastActivityAt",
        header: "Data",
        cell: ({ row }) => new Date(row.original.lastActivityAt).toLocaleString("pt-BR"),
      },
      { accessorKey: "title", header: "Título" },
      { accessorKey: "department", header: "Departamento" },
      { accessorKey: "userRole", header: "Perfil" },
      { accessorKey: "tenantLabel", header: "Tenant" },
      { accessorKey: "messageCount", header: "Msgs" },
      {
        accessorKey: "totalTokens",
        header: "Tokens",
        cell: ({ row }) => formatTokenCount(row.original.totalTokens),
      },
      {
        accessorKey: "estimatedCostUsd",
        header: "Custo",
        cell: ({ row }) => formatCostUsd(row.original.estimatedCostUsd),
      },
      { accessorKey: "primaryModel", header: "Modelo" },
      {
        accessorKey: "ragUsed",
        header: "RAG",
        cell: ({ row }) => (row.original.ragUsed ? "Sim" : "Não"),
      },
      {
        accessorKey: "negativeFeedback",
        header: "Feedback",
        cell: ({ row }) => (row.original.negativeFeedback ? "Negativo" : "—"),
      },
      { accessorKey: "riskLevel", header: "Risco" },
      { accessorKey: "status", header: "Status" },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (!rows.length) {
    return <p className="text-sm text-[var(--color-muted)]">Nenhuma conversa no período.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[var(--color-card)]">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="cursor-pointer whitespace-nowrap px-3 py-2 font-medium text-[var(--color-muted)]"
                  onClick={h.column.getToggleSortingHandler()}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => openConversation(row.original.conversationId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openConversation(row.original.conversationId);
                }
              }}
              className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-card-hover)]/60 focus:bg-[var(--color-card-hover)]/60 focus:outline-none"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-3 py-2 text-[var(--color-foreground)]">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

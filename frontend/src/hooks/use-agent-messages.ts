"use client";

import { useCallback, useReducer } from "react";
import type { TokenUsage } from "@/lib/token-usage";

export type MessageStatus = "sent" | "streaming" | "done" | "failed";

export type MessageAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  previewUrl?: string | null;
};

export type AgentMessageItem = {
  clientId: string;
  serverId?: string;
  role: "user" | "assistant";
  content: string | Record<string, unknown>;
  usage?: TokenUsage;
  status: MessageStatus;
  createdAt: string;
  error?: string;
  attachments?: MessageAttachment[];
};

type State = {
  messages: AgentMessageItem[];
};

type Action =
  | { type: "RESET" }
  | { type: "LOAD"; messages: AgentMessageItem[] }
  | { type: "ADD_USER"; clientId: string; content: string; attachments?: MessageAttachment[] }
  | { type: "ADD_ASSISTANT_PLACEHOLDER"; clientId: string }
  | { type: "STREAM_TOKEN"; clientId: string; token: string }
  | { type: "CONFIRM_USER"; clientId: string; serverId: string; createdAt?: string }
  | {
      type: "CONFIRM_ASSISTANT";
      clientId: string;
      serverId?: string;
      content: string | Record<string, unknown>;
      usage?: TokenUsage;
      createdAt?: string;
    }
  | { type: "FAIL"; clientId: string; error: string }
  | { type: "REMOVE"; clientId: string };

function nowIso() {
  return new Date().toISOString();
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "RESET":
      return { messages: [] };
    case "LOAD":
      return { messages: action.messages };
    case "ADD_USER":
      return {
        messages: [
          ...state.messages,
          {
            clientId: action.clientId,
            role: "user",
            content: action.content,
            attachments: action.attachments,
            status: "sent",
            createdAt: nowIso(),
          },
        ],
      };
    case "ADD_ASSISTANT_PLACEHOLDER":
      return {
        messages: [
          ...state.messages,
          {
            clientId: action.clientId,
            role: "assistant",
            content: "",
            status: "streaming",
            createdAt: nowIso(),
          },
        ],
      };
    case "STREAM_TOKEN":
      return {
        messages: state.messages.map((m) =>
          m.clientId === action.clientId
            ? {
                ...m,
                content:
                  typeof m.content === "string"
                    ? m.content + action.token
                    : action.token,
              }
            : m
        ),
      };
    case "CONFIRM_USER":
      return {
        messages: state.messages.map((m) =>
          m.clientId === action.clientId
            ? { ...m, serverId: action.serverId, createdAt: action.createdAt ?? m.createdAt, status: "done" as const }
            : m
        ),
      };
    case "CONFIRM_ASSISTANT":
      return {
        messages: state.messages.map((m) =>
          m.clientId === action.clientId
            ? {
                ...m,
                serverId: action.serverId ?? m.serverId,
                content: action.content,
                usage: action.usage,
                createdAt: action.createdAt ?? m.createdAt,
                status: "done" as const,
                error: undefined,
              }
            : m
        ),
      };
    case "FAIL":
      return {
        messages: state.messages.map((m) =>
          m.clientId === action.clientId ? { ...m, status: "failed" as const, error: action.error } : m
        ),
      };
    case "REMOVE":
      return { messages: state.messages.filter((m) => m.clientId !== action.clientId) };
    default:
      return state;
  }
}

export function useAgentMessages() {
  const [state, dispatch] = useReducer(reducer, { messages: [] });

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  const load = useCallback((messages: AgentMessageItem[]) => dispatch({ type: "LOAD", messages }), []);

  const addUser = useCallback((clientId: string, content: string, attachments?: MessageAttachment[]) => {
    dispatch({ type: "ADD_USER", clientId, content, attachments });
  }, []);

  const addAssistantPlaceholder = useCallback((clientId: string) => {
    dispatch({ type: "ADD_ASSISTANT_PLACEHOLDER", clientId });
  }, []);

  const streamToken = useCallback((clientId: string, token: string) => {
    dispatch({ type: "STREAM_TOKEN", clientId, token });
  }, []);

  const confirmUser = useCallback((clientId: string, serverId: string, createdAt?: string) => {
    dispatch({ type: "CONFIRM_USER", clientId, serverId, createdAt });
  }, []);

  const confirmAssistant = useCallback(
    (
      clientId: string,
      content: string | Record<string, unknown>,
      opts?: { serverId?: string; usage?: TokenUsage; createdAt?: string }
    ) => {
      dispatch({
        type: "CONFIRM_ASSISTANT",
        clientId,
        content,
        serverId: opts?.serverId,
        usage: opts?.usage,
        createdAt: opts?.createdAt,
      });
    },
    []
  );

  const fail = useCallback((clientId: string, error: string) => {
    dispatch({ type: "FAIL", clientId, error });
  }, []);

  const remove = useCallback((clientId: string) => {
    dispatch({ type: "REMOVE", clientId });
  }, []);

  return {
    messages: state.messages,
    reset,
    load,
    addUser,
    addAssistantPlaceholder,
    streamToken,
    confirmUser,
    confirmAssistant,
    fail,
    remove,
  };
}

export function aggregateSessionUsage(messages: AgentMessageItem[]): TokenUsage | null {
  const empty: TokenUsage = {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    estimated_cost_usd: 0,
    model: "",
    provider: "",
    source: "estimated",
  };
  const acc = messages
    .filter((m) => m.role === "assistant" && m.usage)
    .reduce<TokenUsage>(
      (a, m) => ({
        input_tokens: a.input_tokens + (m.usage?.input_tokens ?? 0),
        output_tokens: a.output_tokens + (m.usage?.output_tokens ?? 0),
        total_tokens: a.total_tokens + (m.usage?.total_tokens ?? 0),
        estimated_cost_usd: a.estimated_cost_usd + (m.usage?.estimated_cost_usd ?? 0),
        model: m.usage?.model ?? a.model,
        provider: m.usage?.provider ?? a.provider,
        source: m.usage?.source ?? a.source,
      }),
      empty
    );
  return acc.total_tokens > 0 ? acc : null;
}

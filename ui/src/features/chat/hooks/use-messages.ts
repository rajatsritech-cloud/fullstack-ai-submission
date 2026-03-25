import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "../api";
import type { Message, Source } from "../types";

const messagesKey = (conversationId: string) =>
  ["conversations", conversationId, "messages"] as const;

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: messagesKey(conversationId!),
    queryFn: () => chatApi.getMessages(conversationId!),
    enabled: !!conversationId,
  });
}

export type StreamingState = {
  isStreaming: boolean;
  streamingContent: string;
  streamingSources: Source[];
  streamingTool: string | null;
};

export function useStreamMessage() {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    streamingContent: "",
    streamingSources: [],
    streamingTool: null,
  });

  const send = useCallback(
    async (conversationId: string, content: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const key = messagesKey(conversationId);

      const optimisticUserMessage: Message = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Message[]>(key, (old) => [
        ...(old ?? []),
        optimisticUserMessage,
      ]);

      setStreamingState({
        isStreaming: true,
        streamingContent: "",
        streamingSources: [],
        streamingTool: null,
      });

      let accumulated = "";

      await chatApi.streamMessage(
        conversationId,
        content,
        {
          token: (char) => {
            accumulated += char;
            setStreamingState((prev) => ({
              ...prev,
              streamingContent: accumulated,
              streamingTool: null,
            }));
          },
          sources: (sources) => {
            setStreamingState((prev) => ({
              ...prev,
              streamingSources: sources,
            }));
          },
          tool_call: (data) => {
            setStreamingState((prev) => ({
              ...prev,
              streamingTool: data.name,
            }));
          },
          done: (finalMessage) => {
            queryClient.setQueryData<Message[]>(key, (old) => {
              const withoutTemp = (old ?? []).filter(
                (m) => !m.id.startsWith("temp-"),
              );
              return [...withoutTemp, finalMessage];
            });
            setStreamingState({
              isStreaming: false,
              streamingContent: "",
              streamingSources: [],
              streamingTool: null,
            });
            queryClient.invalidateQueries({ queryKey: ["conversations"] });
          },
          onError: (error) => {
            console.error("Stream error:", error);
            setStreamingState({
              isStreaming: false,
              streamingContent: "",
              streamingSources: [],
              streamingTool: null,
            });
          },
        },
        controller.signal,
      );
    },
    [queryClient],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setStreamingState({
      isStreaming: false,
      streamingContent: "",
      streamingSources: [],
      streamingTool: null,
    });
  }, []);

  return { send, abort, ...streamingState };
}

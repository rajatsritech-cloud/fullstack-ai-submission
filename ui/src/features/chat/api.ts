import { api, streamSSE, type SSECallbacks } from "@/lib/api-client";
import type {
  Conversation,
  CreateConversationPayload,
  Message,
  StreamEvents,
} from "./types";

export const chatApi = {
  getConversations: () => api.get<Conversation[]>("/conversations"),

  getConversation: (id: string) =>
    api.get<Conversation>(`/conversations/${id}`),

  createConversation: (payload?: CreateConversationPayload) =>
    api.post<Conversation>("/conversations", payload),

  deleteConversation: (id: string) =>
    api.delete<void>(`/conversations/${id}`),

  getMessages: (conversationId: string) =>
    api.get<Message[]>(`/conversations/${conversationId}/messages`),

  streamMessage: (
    conversationId: string,
    content: string,
    callbacks: SSECallbacks<StreamEvents>,
    signal?: AbortSignal,
  ) =>
    streamSSE<StreamEvents>(
      `/conversations/${conversationId}/messages`,
      { content },
      callbacks,
      signal,
    ),
};

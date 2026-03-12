import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chatApi } from "../api";
import type { CreateConversationPayload } from "../types";

const CONVERSATIONS_KEY = ["conversations"] as const;

export function useConversations() {
  return useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: chatApi.getConversations,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: CreateConversationPayload) =>
      chatApi.createConversation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: chatApi.deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

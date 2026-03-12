export type MessageRole = "user" | "assistant";

export type Source = {
  document: string;
  chunk: string;
  score: number;
};

export type Message = {
  id: string;
  role: MessageRole;
  content: string;
  sources?: Source[];
  created_at: string;
};

export type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type SendMessagePayload = {
  conversation_id: string;
  content: string;
};

export type CreateConversationPayload = {
  title?: string;
};

export type StreamEvents = {
  token: string;
  sources: Source[];
  done: Message;
  error: string;
};

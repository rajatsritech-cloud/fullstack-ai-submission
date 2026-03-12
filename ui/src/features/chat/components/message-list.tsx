import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages, type StreamingState } from "../hooks/use-messages";
import { MessageBubble } from "./message-bubble";

type MessageListProps = {
  conversationId: string | null;
  streaming: StreamingState;
};

function MessageListSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`flex gap-3 ${i % 2 === 0 ? "flex-row" : "flex-row-reverse"}`}
        >
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <Skeleton
            className={`h-16 ${i % 2 === 0 ? "w-3/5" : "w-2/5"} rounded-xl`}
          />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <p className="text-lg font-medium">Start a conversation</p>
      <p className="text-sm">
        Send a message to begin chatting with the AI assistant.
      </p>
    </div>
  );
}

function StreamingBubble({ content }: { content: string }) {
  return (
    <div className="flex gap-3">
      <Avatar className="mt-0.5 size-7 shrink-0">
        <AvatarFallback className="bg-muted text-xs text-muted-foreground">
          <Bot className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="max-w-[75%] rounded-xl bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
        {content ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="flex gap-1 py-1">
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageList({ conversationId, streaming }: MessageListProps) {
  const { data: messages, isLoading } = useMessages(conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming.streamingContent]);

  if (!conversationId) {
    return <EmptyState />;
  }

  if (isLoading) {
    return <MessageListSkeleton />;
  }

  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        {messages?.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {streaming.isStreaming && (
          <StreamingBubble content={streaming.streamingContent} />
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

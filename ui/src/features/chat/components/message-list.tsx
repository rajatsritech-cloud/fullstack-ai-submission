import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Settings2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages, type StreamingState } from "../hooks/use-messages";
import { MessageBubble } from "./message-bubble";

type MessageListProps = {
  conversationId: string | null;
  streaming: StreamingState;
  onScroll?: (scrolled: boolean) => void;
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



function StreamingBubble({
  content,
  toolName,
}: {
  content: string;
  toolName: string | null;
}) {
  return (
    <div className="flex w-full justify-start">
      <div className="flex gap-4 w-full">
        <Avatar className="mt-0.5 size-7 shrink-0 border shadow-sm">
          <AvatarFallback className="bg-background text-muted-foreground text-xs">
            <Bot className="size-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 pt-1 text-[15px] text-foreground">
          {toolName ? (
             <div className="flex items-center gap-2.5 text-muted-foreground">
               <Settings2 className="size-4 animate-spin text-primary" />
               <span className="font-medium animate-pulse">Running {toolName}...</span>
             </div>
          ) : content ? (
            <div className="prose dark:prose-invert prose-p:leading-relaxed max-w-none prose-pre:p-0 prose-pre:bg-[#f4f4f4] dark:prose-pre:bg-[#2f2f2f] prose-a:text-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex gap-1 py-1">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MessageList({ conversationId, streaming, onScroll }: MessageListProps) {
  const { data: messages, isLoading } = useMessages(conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    onScroll?.(target.scrollTop > 5);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming.streamingContent]);

  if (!conversationId) {
    return null;
  }

  if (isLoading) {
    return <MessageListSkeleton />;
  }

  return (
    <ScrollArea onScroll={handleScroll} className="flex-1 min-h-0 w-full">
      <div className="mx-auto flex max-w-[768px] flex-col gap-6 px-4 pt-28 pb-8">
        {messages?.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {streaming.isStreaming && (
          <StreamingBubble
            content={streaming.streamingContent}
            toolName={streaming.streamingTool}
          />
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}

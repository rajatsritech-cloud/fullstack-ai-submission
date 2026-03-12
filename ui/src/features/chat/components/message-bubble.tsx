import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Message } from "../types";

type MessageBubbleProps = {
  message: Message;
};

function SourcesList({ sources }: { sources: Message["sources"] }) {
  if (!sources?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {sources.map((source, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[0.65rem] text-muted-foreground"
        >
          {source.document}
        </span>
      ))}
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <Avatar className="mt-0.5 size-7 shrink-0">
        <AvatarFallback
          className={cn(
            "text-xs",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && <SourcesList sources={message.sources} />}
      </div>
    </div>
  );
}

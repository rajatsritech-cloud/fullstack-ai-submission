import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Copy, Check } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Message } from "../types";

type MessageBubbleProps = {
  message: Message;
};

export function SourcesList({ sources }: { sources: Message["sources"] }) {
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  if (!sources?.length) return null;

  // Deduplicate for badges
  const uniqueDocs = Array.from(new Set(sources.map((s) => s.document)));
  const viewSources = selectedDoc ? sources.filter((s) => s.document === selectedDoc) : [];

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {uniqueDocs.map((doc, i) => (
          <button
            key={i}
            onClick={() => setSelectedDoc(doc)}
            className="inline-flex items-center rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors px-3 py-1 space-x-1.5 cursor-pointer"
          >
            <span className="text-[12px] font-medium text-foreground/80">{doc}</span>
          </button>
        ))}
      </div>

      <Sheet open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto border-l-0 shadow-2xl">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-semibold">{selectedDoc}</SheetTitle>
            <SheetDescription>
              Retrieved context snippets used by the AI to formulate this response.
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex flex-col gap-6">
             {viewSources.map((source, idx) => (
                <div key={idx} className="bg-white dark:bg-[#1a1a1a] rounded-xl p-5 border border-black/5 dark:border-white/10 relative shadow-sm overflow-hidden group">
                   <div className="absolute top-0 right-0 bg-black/5 dark:bg-white/10 backdrop-blur-md text-[10px] px-2.5 py-1.5 rounded-bl-xl text-muted-foreground font-semibold z-10">
                      Match Score: {(source.score * 100).toFixed(1)}%
                   </div>
                   <div className="prose dark:prose-invert prose-sm max-w-full pt-4 overflow-x-auto 
                       [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-black/10 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full">
                      <div className="text-foreground font-normal leading-relaxed">
                         <ReactMarkdown remarkPlugins={[remarkGfm]}>{source.chunk}</ReactMarkdown>
                      </div>
                   </div>
                </div>
             ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors flex items-center gap-1.5 mt-1"
      title="Copy message"
    >
      {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      {isUser ? (
        <div className="max-w-[70%] bg-[#f4f4f4] dark:bg-[#2f2f2f] text-foreground px-5 py-2.5 rounded-[22px] text-[15px] leading-relaxed">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      ) : (
        <div className="flex gap-4 w-full">
          <Avatar className="mt-0.5 size-7 shrink-0 border shadow-sm">
            <AvatarFallback className="bg-background text-muted-foreground text-xs">
              <Bot className="size-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="prose dark:prose-invert prose-p:leading-relaxed text-[15px] text-foreground max-w-none 
                prose-code:text-black dark:prose-code:text-white prose-code:font-semibold prose-code:before:content-none prose-code:after:content-none 
                prose-pre:p-4 prose-pre:bg-[#f4f4f4] dark:prose-pre:bg-[#1a1a1a] prose-pre:text-black dark:prose-pre:text-white
                prose-a:text-primary [&_pre]:!opacity-100 [&_code]:!opacity-100">
               <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
            <div className="mt-4 border-t border-black/5 dark:border-white/10 pt-3">
               <SourcesList sources={message.sources} />
            </div>
            <div className="-ml-1">
               <CopyButton content={message.content} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

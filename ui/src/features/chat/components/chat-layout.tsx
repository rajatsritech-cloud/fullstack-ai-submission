import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Share, MoreHorizontal, ChevronDown, Copy, Mail, Check, X, Sparkles, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatSidebar } from "./chat-sidebar";
import { MessageInput } from "./message-input";
import { MessageList } from "./message-list";
import { useStreamMessage } from "../hooks/use-messages";
import { useCreateConversation, useDeleteConversation } from "../hooks/use-conversations";

function ShareModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || typeof document === "undefined") return null;

  const shareUrl = window.location.href;
  const emailSubject = "Check out this AI Chat conversation";
  const emailBody = `Hey, I wanted to share this conversation from our AI Assistant with you:\n\nLink: ${shareUrl}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Share conversation</h3>
          <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-muted-foreground">Share Link</label>
            <div className="flex items-center gap-2 bg-muted p-2 rounded-xl border">
              <input
                readOnly
                value={shareUrl}
                className="bg-transparent flex-1 text-sm outline-none px-2 truncate"
              />
              <Button size="sm" onClick={handleCopy} className="rounded-lg px-3 h-8">
                {copied ? <Check className="size-4" /> : <Copy className="size-4 mr-2" />}
                {copied ? "" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <a
              href={`mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
              className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border bg-card hover:bg-muted transition-all group"
            >
              <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                <Mail className="size-6" />
              </div>
              <span className="text-sm font-medium">Email</span>
            </a>

            <button
              onClick={handleCopy}
              className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border bg-card hover:bg-muted transition-all group"
            >
              <div className="p-3 rounded-full bg-green-500/10 text-green-500 group-hover:bg-green-500/20 transition-colors">
                <Share className="size-6" />
              </div>
              <span className="text-sm font-medium">Link</span>
            </button>
          </div>
        </div>

        <div className="bg-muted/50 p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Anyone with the link can view this conversation.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ChatHeader({ onShare, onDelete, isScrolled }: { onShare: () => void, onDelete: () => void, isScrolled: boolean }) {
  const [isAssistantMenuOpen, setIsAssistantMenuOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const assistantMenuRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assistantMenuRef.current && !assistantMenuRef.current.contains(event.target as Node)) {
        setIsAssistantMenuOpen(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setIsActionMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="sticky top-3 inset-x-0 z-30 px-4 pointer-events-none">
      <div className={`mx-auto max-w-[768px] h-14 bg-background/70 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-2xl flex items-center justify-between px-3 transition-all duration-500 pointer-events-auto ${isScrolled ? "shadow-[0_8px_30px_rgb(0,0,0,0.08)] bg-background/85" : "shadow-sm"}`}>
        {/* Brand Identity */}
        <div className="flex items-center gap-2.5 pl-1 relative" ref={assistantMenuRef}>
          <div className="size-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <Sparkles className="size-4.5" fill="currentColor" />
          </div>
          <button
            onClick={() => setIsAssistantMenuOpen(!isAssistantMenuOpen)}
            className="flex items-center gap-2 group"
          >
            <div className="flex flex-col items-start">
              <span className="text-[15px] font-bold tracking-tight leading-none">Cortex AI</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="size-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/70">GPT-4o</span>
              </div>
            </div>
            <ChevronDown className={`size-3.5 text-muted-foreground/50 transition-transform duration-300 ${isAssistantMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {isAssistantMenuOpen && (
            <div className="absolute top-full left-0 mt-3 w-64 bg-background border border-border shadow-2xl rounded-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Engine Status</div>
              <div className="flex items-center gap-3 w-full px-3 py-3 bg-black/5 dark:bg-white/5 rounded-xl transition-colors text-left opacity-90 cursor-default">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Sparkles className="size-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[14.5px] font-medium leading-none">Cortex (GPT-4o)</span>
                  <span className="text-[11px] text-muted-foreground mt-1.5 leading-tight italic">
                    Optimized for deep reasoning and GitHub integration.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Power Pill */}
        <div className="flex items-center bg-black/[0.03] dark:bg-white/[0.04] p-1 rounded-xl gap-1" ref={actionMenuRef}>
          <button
            onClick={onShare}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-white dark:hover:bg-white/10 rounded-lg transition-all text-[13px] font-semibold shadow-sm hover:shadow group"
          >
            <Share className="size-3.5 text-muted-foreground group-hover:text-foreground" />
            <span>Share</span>
          </button>

          <div className="w-px h-4 bg-black/5 dark:bg-white/10 mx-0.5" />

          <button
            onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
            className="size-8 flex items-center justify-center hover:bg-white dark:hover:bg-white/10 rounded-lg transition-all relative"
          >
            <MoreHorizontal className="size-4 text-muted-foreground" />

            {isActionMenuOpen && (
              <div className="absolute top-full right-0 mt-3 w-48 bg-background border border-border shadow-2xl rounded-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsActionMenuOpen(false); onDelete(); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-red-500/10 text-red-600 rounded-xl transition-colors text-left group"
                >
                  <Trash2 className="size-4" />
                  <span className="text-[14px] font-bold">Delete Session</span>
                </button>
                <button className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-colors text-left">
                  <Info className="size-4 text-muted-foreground" />
                  <span className="text-[14px] font-medium">Session Info</span>
                </button>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChatLayout() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const { send, isStreaming, streamingContent, streamingSources, streamingTool } =
    useStreamMessage();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

  const handleSend = async (content: string) => {
    let conversationId = activeConversationId;
    if (!conversationId) {
      // Create a clean title without punctuation
      const cleanTitle = content
        .slice(0, 40)
        .replace(/[^\w\s\u00C0-\u00FF]/gi, '') // Remove punctuation but keep letters, numbers, and spaces
        .trim();

      const conversation = await createConversation.mutateAsync({
        title: cleanTitle || "New Chat",
      });
      conversationId = conversation.id;
      setActiveConversationId(conversationId);
    }
    send(conversationId, content);
  };

  return (
    <SidebarProvider>
      <ChatSidebar
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
      />
      <SidebarInset>
        <div className="flex h-svh flex-col relative w-full bg-background overflow-hidden message-list-container">
          <ChatHeader
            onShare={() => setIsShareModalOpen(true)}
            onDelete={() => setShowDeleteConfirm(true)}
            isScrolled={isScrolled}
          />

          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
          />

          {showDeleteConfirm && activeConversationId && typeof document !== "undefined" && createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200">
              <div className="bg-background border border-border shadow-2xl rounded-2xl w-[340px] p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                <div>
                  <h3 className="font-semibold text-[18px]">Delete chat?</h3>
                  <p className="text-[15px] text-muted-foreground mt-2 leading-relaxed">
                    This will permanently delete this conversation and all its messages.
                  </p>
                </div>
                <div className="flex w-full gap-2 items-center justify-end mt-2">
                  <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl px-5">Cancel</Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      deleteConversation.mutate(activeConversationId);
                      setActiveConversationId(null);
                      setShowDeleteConfirm(false);
                    }}
                    className="rounded-xl px-5 bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {!activeConversationId ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 w-full h-full -mt-10">
              <h1 className="text-[32px] font-semibold text-foreground mb-8 tracking-tight">What can I help you achieve today?</h1>
              <div className="w-full max-w-[768px]">
                <MessageInput
                  onSend={handleSend}
                  disabled={createConversation.isPending}
                />
              </div>
            </div>
          ) : (
            <>
              <MessageList
                conversationId={activeConversationId}
                streaming={{ isStreaming, streamingContent, streamingSources, streamingTool }}
                onScroll={setIsScrolled}
              />
              <div className="w-full shrink-0 z-20 pb-6 pt-2 px-4 md:px-0 bg-background">
                <div className="mx-auto max-w-[768px] w-full">
                  <MessageInput
                    onSend={handleSend}
                    disabled={isStreaming}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

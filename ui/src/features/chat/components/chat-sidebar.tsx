import { useState } from "react"
import { createPortal } from "react-dom"
import { SquarePen, Trash2, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
} from "../hooks/use-conversations"
import type { Conversation } from "../types"

type ChatSidebarProps = {
  activeConversationId: string | null
  onSelectConversation: (id: string | null) => void
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: {
  conversation: Conversation
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <>
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect} className="text-[13.5px] py-1.5 h-auto">
        <MessageSquare className="mr-2 size-3.5 opacity-60" />
        <span className="truncate font-medium">{conversation.title || "New Chat"}</span>
      </SidebarMenuButton>
      <SidebarMenuAction
        onClick={(e) => {
          e.stopPropagation()
          setShowConfirm(true)
        }}
        className="opacity-0 group-hover/menu-item:opacity-100 dark:hover:bg-white/10 cursor-pointer"
      >
        <Trash2 className="size-3.5 text-muted-foreground" />
      </SidebarMenuAction>
    </SidebarMenuItem>

    {showConfirm && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 dark:bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
         <div className="bg-background border border-border/50 shadow-2xl rounded-2xl w-[320px] p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div>
               <h3 className="font-semibold text-[17px] text-foreground">Delete chat?</h3>
               <p className="text-[14.5px] text-muted-foreground mt-1.5 leading-relaxed">
                  This will delete <strong className="text-foreground font-medium">"{conversation.title || "New Chat"}"</strong>.
               </p>
            </div>
            <div className="flex w-full gap-2 items-center justify-end mt-2">
               <Button variant="ghost" onClick={(e) => { e.stopPropagation(); setShowConfirm(false); }} className="rounded-xl px-5 h-9 font-medium text-[14.5px]">Cancel</Button>
               <Button variant="destructive" onClick={(e) => { e.stopPropagation(); setShowConfirm(false); onDelete(); }} className="rounded-xl px-5 h-9 font-medium text-[14.5px] bg-[#e53e3e] hover:bg-[#c53030] text-white">Delete</Button>
            </div>
         </div>
      </div>,
      document.body
    )}
    </>
  )
}

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  )
}

export function ChatSidebar({
  activeConversationId,
  onSelectConversation,
}: ChatSidebarProps) {
  const { data: conversations, isLoading } = useConversations()
  const createConversation = useCreateConversation()
  const deleteConversation = useDeleteConversation()
  const { state } = useSidebar()

  const handleNewChat = () => {
    onSelectConversation(null)
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-[#f9f9f9] dark:bg-[#171717]">
      <SidebarHeader className="p-2">
        <div className={`flex items-center justify-between gap-1 overflow-hidden ${state === "collapsed" ? "flex-col" : "flex-row"}`}>
           <SidebarTrigger className="text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 size-9 [&_svg]:size-5" />
           <Button variant="ghost" size="icon" onClick={handleNewChat} disabled={createConversation.isPending} className="text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 size-9">
              <SquarePen className="size-5" />
           </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="group-data-[collapsible=icon]:hidden">
        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarGroupContent>
            {isLoading ? (
              <SidebarSkeleton />
            ) : (
              <SidebarMenu>
                {conversations?.map((conversation) => (
                  <ConversationItem
                    key={conversation.id}
                    conversation={conversation}
                    isActive={conversation.id === activeConversationId}
                    onSelect={() => onSelectConversation(conversation.id)}
                    onDelete={() => {
                        deleteConversation.mutate(conversation.id)
                        if (conversation.id === activeConversationId) {
                           onSelectConversation(null)
                        }
                    }}
                  />
                ))}
                {conversations?.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                    No conversations yet
                  </p>
                )}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

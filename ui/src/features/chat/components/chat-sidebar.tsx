import { MessageSquarePlus, Trash2 } from "lucide-react"
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
  onSelectConversation: (id: string) => void
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
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect}>
        <span className="truncate">{conversation.title || "New Chat"}</span>
      </SidebarMenuButton>
      <SidebarMenuAction
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="opacity-0 group-hover/menu-item:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </SidebarMenuAction>
    </SidebarMenuItem>
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

  const handleNewChat = async () => {
    const conversation = await createConversation.mutateAsync({})
    onSelectConversation(conversation.id)
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-sm font-semibold">Chats</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleNewChat}
            disabled={createConversation.isPending}
          >
            <MessageSquarePlus className="size-4" />
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
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
                    onDelete={() => deleteConversation.mutate(conversation.id)}
                  />
                ))}
                {conversations?.length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
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

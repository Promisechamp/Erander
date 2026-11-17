import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { openErrandChat } from "@/services/chat/chatApi";
import ChatModal from "@/pages/chat/ChatModal";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [chatId, setChatId] = useState(null);
  const [opening, setOpening] = useState(false);

  const openChat = useCallback(async ({ errandId, eranderId }) => {
    if (!errandId || !eranderId || opening) return null;
    setOpening(true);
    try {
      const result = await openErrandChat(errandId, eranderId);
      const id = result?.data?.chatId;
      if (!id) throw new Error("The conversation could not be opened.");
      setChatId(id);
      return id;
    } catch (error) {
      toast.error(error?.message || "Unable to open this conversation.");
      return null;
    } finally {
      setOpening(false);
    }
  }, [opening]);

  const closeChatModal = useCallback(() => setChatId(null), []);
  const value = useMemo(() => ({ openChat, closeChatModal, opening }), [openChat, closeChatModal, opening]);

  return (
    <ChatContext.Provider value={value}>
      {children}
      <ChatModal chatId={chatId} onClose={closeChatModal} />
    </ChatContext.Provider>
  );
}

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat must be used inside ChatProvider.");
  return value;
}

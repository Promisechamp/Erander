import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";

import Modal from "@/components/Modal";
import ChatThread from "./ChatThread";

export default function ChatModal({ chatId, onClose }) {
  const navigate = useNavigate();
  if (!chatId) return null;

  const viewFull = () => {
    const id = chatId;
    onClose?.();
    navigate(`/chat/${encodeURIComponent(id)}`);
  };

  return (
    <Modal
      isOpen={Boolean(chatId)}
      onClose={onClose}
      dismissible
      icon={MessageCircle}
      tone="success"
      title="Chat"
      subtitle="ERANDER chat"
      size="lg"
      position="center"
    >
      <ChatThread
        chatId={chatId}
        mode="modal"
        onClose={onClose}
        onViewFull={viewFull}
      />
    </Modal>
  );
}
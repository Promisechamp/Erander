import { Copy } from "lucide-react";

import Modal from "@/components/Modal";

import { BTN_GHOST, BTN_NAVY } from "./recordsStyles";
import { copyText } from "./recordsUtils";

export default function TextDialog({ data, onClose }) {
  return (
    <Modal
      isOpen={!!data}
      onClose={onClose}
      title={data?.title || "Full text"}
      subtitle="Full value"
      description=""
      size="md"
      position="bottom"
      height="auto"
      headerTone="navy"
      zIndex={120}
    >
      {data ? (
        <div className="space-y-5">
          <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-surface-muted/60 p-4 font-mono text-xs leading-6 text-content">
            {data.text}
          </pre>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={BTN_GHOST}>
              Close
            </button>
            <button
              type="button"
              onClick={() => copyText(data.text, "Copied")}
              className={BTN_NAVY}
            >
              <Copy size={14} aria-hidden="true" />
              Copy text
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
import { useEffect, useState } from "react";
import { ImageOff, LoaderCircle } from "lucide-react";

export default function PrivateChatImage({ src, alt = "Chat image", className = "" }) {
  const [objectUrl, setObjectUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let createdUrl = "";
    setObjectUrl("");
    setFailed(false);

    fetch(src, { credentials: "include", cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Image unavailable");
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src]);

  if (failed) {
    return <div className={`inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-3 text-xs text-slate-500 ${className}`}><ImageOff size={15} /> Image unavailable</div>;
  }
  if (!objectUrl) {
    return <div className={`inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-3 text-xs text-slate-500 ${className}`}><LoaderCircle size={14} className="animate-spin" /> Loading image…</div>;
  }
  return <img src={objectUrl} alt={alt} loading="lazy" className={className} />;
}

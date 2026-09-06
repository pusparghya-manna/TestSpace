import React from "react";
import { mediaUrl } from "../api";

interface Props {
  imageUrl?: string | null;
  imageFileId?: string | null;
  alt?: string;
}

export const QuestionImage: React.FC<Props> = ({ imageUrl, imageFileId, alt = "Question diagram" }) => {
  const src = mediaUrl(imageUrl || imageFileId);
  if (!src) return null;
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200/60 bg-white/50 mb-3">
      <img
        src={src}
        alt={alt}
        className="w-full max-h-64 object-contain bg-white"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

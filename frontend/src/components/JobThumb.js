/**
 * Reusable iş görseli küçük önizleme (thumbnail) bileşeni.
 *
 * Kullanım:
 *   <JobThumb job={job} onOpen={() => openImagePreview(job)} size={48} />
 *
 * Özellikler:
 *  - Listeden gelen `thumb_url` (data URL ~5KB) ile anında preview gösterir.
 *  - Yoksa eski yol: `image_url` veya `has_image` → placeholder ikon.
 *  - Tıklama event'i drag/touch event'lerini durdurur (sürükle-bırak listelerinde güvenli).
 */
import React from "react";
import { Image as ImageIcon } from "lucide-react";
import { API } from "../App";

export default function JobThumb({ job, onOpen, size = 48, className = "" }) {
  if (!job) return null;
  const hasAny = !!(job.thumb_url || job.image_url || job.has_image);
  if (!hasAny) return null;

  const srcRaw = job.thumb_url || job.image_url;
  const src = srcRaw
    ? (srcRaw.startsWith("data:") || srcRaw.startsWith("http")
        ? srcRaw
        : `${API.replace("/api", "")}${srcRaw}`)
    : null;

  const px = `${size}px`;
  return (
    <button
      type="button"
      data-testid={`job-thumb-${job.id}`}
      onClick={(e) => { e.stopPropagation(); onOpen?.(job); }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      draggable={false}
      style={{ width: px, height: px }}
      className={`relative shrink-0 rounded-md overflow-hidden border border-secondary/30 hover:border-secondary hover:scale-105 transition-all bg-background group ${className}`}
      aria-label="Görseli aç"
      title="Görseli büyüt"
    >
      {src ? (
        <img
          src={src}
          alt={job.name || "İş görseli"}
          draggable={false}
          className="w-full h-full object-cover pointer-events-none"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface-highlight/40">
          <ImageIcon className="w-1/2 h-1/2 text-text-secondary" />
        </div>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
        <ImageIcon className="w-1/3 h-1/3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
    </button>
  );
}

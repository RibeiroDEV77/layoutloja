/**
 * AssetThumb — preview compacto de um asset (resolve URL conforme driver).
 */
import { useState } from "react";
import { Image as ImageIcon, FileText, Film, Youtube, Video } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssetLike = {
  id: string;
  kind: string;
  storage_driver: string;
  preview_url?: string | null;
  external_url?: string | null;
  external_id?: string | null;
  title?: string | null;
  alt_text?: string | null;
  original_filename?: string | null;
};

function ytThumb(id: string) { return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }

function isUnsupportedImage(filename?: string | null) {
  if (!filename) return false;
  return /\.(heic|heif|tiff?|avif)$/i.test(filename);
}

function ImagePreview({ src, alt, filename }: { src: string; alt: string; filename?: string | null }) {
  const [errored, setErrored] = useState(false);
  const unsupported = isUnsupportedImage(filename);
  if (errored || unsupported) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 p-2 text-center">
        <ImageIcon className="h-6 w-6" />
        <span className="text-[10px] leading-tight break-all line-clamp-2">
          {filename ?? alt}
        </span>
        {unsupported && <span className="text-[9px] uppercase opacity-60">formato não suportado pelo navegador</span>}
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setErrored(true)} className="h-full w-full object-cover" />;
}

export function AssetThumb({ asset, className }: { asset: AssetLike; className?: string }) {
  const alt = asset.alt_text || asset.title || asset.original_filename || "Asset";
  const wrapper = cn(
    "relative aspect-square w-full overflow-hidden rounded-md bg-muted flex items-center justify-center text-muted-foreground",
    className,
  );

  if (asset.kind === "image" || asset.kind === "svg") {
    const src = asset.preview_url ?? asset.external_url ?? undefined;
    if (src) return <div className={wrapper}><ImagePreview src={src} alt={alt} filename={asset.original_filename} /></div>;
  }
  if (asset.kind === "youtube" && asset.external_id) {
    return <div className={wrapper}><img src={ytThumb(asset.external_id)} alt={alt} loading="lazy" className="h-full w-full object-cover" /><Youtube className="absolute h-8 w-8 text-white drop-shadow" /></div>;
  }
  if (asset.kind === "vimeo") {
    return <div className={wrapper}><Video className="h-8 w-8" /></div>;
  }
  if (asset.kind === "video") {
    return <div className={wrapper}><Film className="h-8 w-8" /></div>;
  }
  if (asset.kind === "pdf") {
    return <div className={wrapper}><FileText className="h-8 w-8" /></div>;
  }
  return <div className={wrapper}><ImageIcon className="h-8 w-8" /></div>;
}

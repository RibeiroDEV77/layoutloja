import { useRef, useState } from "react";
import { Upload, X, Loader2, GripVertical } from "lucide-react";
import { FormField, type FormFieldProps } from "./form-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GalleryImage = { id: string; url: string; alt?: string };

export type ImageGalleryFieldProps = Omit<FormFieldProps, "children"> & {
  images: GalleryImage[];
  onUpload: (file: File) => Promise<GalleryImage>;
  onRemove: (id: string) => void | Promise<void>;
  onReorder?: (orderedIds: string[]) => void | Promise<void>;
  maxImages?: number;
  maxSizeMB?: number;
  accept?: string;
  disabled?: boolean;
};

export function ImageGalleryField({
  images, onUpload, onRemove, onReorder,
  maxImages = 12, maxSizeMB = 5, accept = "image/*", disabled, ...field
}: ImageGalleryFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const handleFiles = async (files: FileList) => {
    setLocalError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (images.length >= maxImages) { setLocalError(`Máximo ${maxImages} imagens`); break; }
        if (file.size > maxSizeMB * 1024 * 1024) { setLocalError(`Arquivo excede ${maxSizeMB}MB`); continue; }
        await onUpload(file);
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || !onReorder || dragId === targetId) return;
    const order = images.map((i) => i.id);
    const from = order.indexOf(dragId);
    const to = order.indexOf(targetId);
    order.splice(to, 0, order.splice(from, 1)[0]);
    onReorder(order);
    setDragId(null);
  };

  return (
    <FormField {...field} error={field.error ?? localError ?? undefined}>
      <input
        ref={inputRef} type="file" multiple accept={accept} className="hidden" disabled={disabled || busy}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {images.map((img) => (
          <div
            key={img.id}
            draggable={!!onReorder && !disabled}
            onDragStart={() => setDragId(img.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(img.id)}
            className={cn(
              "relative aspect-square rounded-md border overflow-hidden bg-muted group",
              dragId === img.id && "opacity-50"
            )}
          >
            <img src={img.url} alt={img.alt ?? ""} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-start justify-between p-1 opacity-0 group-hover:opacity-100">
              {onReorder && <GripVertical className="h-4 w-4 text-white/90 cursor-grab" />}
              <Button
                type="button" variant="destructive" size="icon" className="h-6 w-6 ml-auto"
                disabled={disabled} onClick={() => onRemove(img.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        {images.length < maxImages && (
          <button
            type="button" disabled={disabled || busy} onClick={() => inputRef.current?.click()}
            className={cn(
              "aspect-square rounded-md border-2 border-dashed flex flex-col items-center justify-center gap-1",
              "text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors",
              (disabled || busy) && "opacity-50 cursor-not-allowed"
            )}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="text-xs">Adicionar</span>
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground pt-1">
        {images.length}/{maxImages} imagens · máx {maxSizeMB}MB por arquivo
      </p>
    </FormField>
  );
}

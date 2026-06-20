import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { FormField, type FormFieldProps } from "./form-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UploadFieldProps = Omit<FormFieldProps, "children"> & {
  value?: string | null;            // URL of the uploaded file
  onUpload: (file: File) => Promise<string>;  // returns the public URL
  onRemove?: () => void | Promise<void>;
  accept?: string;
  maxSizeMB?: number;
  preview?: boolean;
  disabled?: boolean;
};

export function UploadField({
  value, onUpload, onRemove, accept = "image/*", maxSizeMB = 5,
  preview = true, disabled, ...field
}: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      setLocalError(`Arquivo excede ${maxSizeMB}MB`);
      return;
    }
    setLocalError(null);
    setBusy(true);
    try {
      await onUpload(file);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const isImage = value && /\.(png|jpe?g|webp|gif|svg|avif)/i.test(value);

  return (
    <FormField {...field} error={field.error ?? localError ?? undefined}>
      <input
        ref={inputRef} type="file" accept={accept} className="hidden"
        disabled={disabled || busy}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-md border p-2">
          {preview && isImage ? (
            <img src={value} alt="" className="h-14 w-14 rounded object-cover bg-muted" />
          ) : (
            <div className="h-14 w-14 rounded bg-muted grid place-items-center text-xs text-muted-foreground">file</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{value.split("/").pop()}</p>
            <p className="text-xs text-muted-foreground">Arquivo enviado</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled || busy}>
            Trocar
          </Button>
          {onRemove && (
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemove()} disabled={disabled || busy}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <button
          type="button" disabled={disabled || busy} onClick={() => inputRef.current?.click()}
          className={cn(
            "w-full flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-md border-2 border-dashed",
            "text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors",
            (disabled || busy) && "opacity-50 cursor-not-allowed"
          )}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          <span className="text-sm">{busy ? "Enviando..." : "Clique para enviar"}</span>
          <span className="text-xs">Máximo {maxSizeMB}MB</span>
        </button>
      )}
    </FormField>
  );
}

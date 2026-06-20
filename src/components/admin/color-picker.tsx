import { FormField, type FormFieldProps } from "./form-field";
import { Input } from "@/components/ui/input";

export type ColorPickerProps = Omit<FormFieldProps, "children"> & {
  value: string | undefined;
  onChange: (hex: string) => void;
  presets?: string[];
  disabled?: boolean;
};

const DEFAULT_PRESETS = [
  "#000000", "#ffffff", "#f43f5e", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280", "#7c2d12",
];

export function ColorPicker({
  value, onChange, presets = DEFAULT_PRESETS, disabled, ...field
}: ColorPickerProps) {
  const v = value ?? "#000000";
  return (
    <FormField {...field}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={v}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-md border bg-background cursor-pointer disabled:opacity-50"
          aria-label="Selecionar cor"
        />
        <Input
          value={v}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono uppercase"
          maxLength={9}
        />
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {presets.map((p) => (
            <button
              type="button" key={p} disabled={disabled}
              onClick={() => onChange(p)}
              className="h-6 w-6 rounded-md border ring-offset-background transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              style={{ backgroundColor: p }}
              aria-label={p}
            />
          ))}
        </div>
      )}
    </FormField>
  );
}

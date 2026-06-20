import { FormField, type FormFieldProps } from "./form-field";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectFieldProps = Omit<FormFieldProps, "children"> & {
  value: string | undefined;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
};

export function SelectField({
  value, onChange, options, placeholder = "Selecione...", disabled, ...field
}: SelectFieldProps) {
  return (
    <FormField {...field}>
      <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={field.id}><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

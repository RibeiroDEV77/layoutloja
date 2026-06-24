import { useEffect, useRef, useState } from "react";
import { Loader2, Truck } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { quoteShippingForAddress } from "@/lib/business/storefront-account.functions";

export interface AddressFormValue {
  id?: string;
  label?: string | null;
  type?: "residencial" | "comercial" | "outro";
  recipient?: string | null;
  zipcode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  phone?: string | null;
  is_default_shipping?: boolean;
  is_default_billing?: boolean;
}

interface Props {
  value: AddressFormValue;
  onChange: (v: AddressFormValue) => void;
  showShippingQuote?: boolean;
}

function maskCep(s: string) {
  const d = s.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function AddressForm({ value, onChange, showShippingQuote = true }: Props) {
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const quote = useServerFn(quoteShippingForAddress);
  const quoteMut = useMutation({
    mutationFn: (cep: string) => quote({ data: { destination_postal_code: cep, weight_g: 500 } }),
  });

  const cepDigits = (value.zipcode ?? "").replace(/\D/g, "");

  // Auto-lookup quando o CEP completa 8 dígitos
  useEffect(() => {
    if (cepDigits.length !== 8) {
      setCepError(null);
      return;
    }
    let cancelled = false;
    setCepLoading(true);
    setCepError(null);
    (async () => {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        const json = await res.json();
        if (cancelled) return;
        if (json.erro) {
          setCepError("CEP inválido");
          return;
        }
        onChange({
          ...value,
          street: json.logradouro || value.street || "",
          district: json.bairro || value.district || "",
          city: json.localidade || value.city || "",
          state: json.uf || value.state || "",
          country: "BR",
        });
        toast.success("Endereço encontrado");
        setTimeout(() => numberRef.current?.focus(), 0);
        if (showShippingQuote) quoteMut.mutate(cepDigits);
      } catch {
        if (!cancelled) setCepError("Não foi possível buscar o CEP");
      } finally {
        if (!cancelled) setCepLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepDigits]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Apelido (opcional)">
        <Input
          value={value.label ?? ""}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="Casa, trabalho..."
        />
      </Field>
      <Field label="Destinatário">
        <Input
          value={value.recipient ?? ""}
          onChange={(e) => onChange({ ...value, recipient: e.target.value })}
        />
      </Field>

      <Field label="CEP" error={cepError}>
        <div className="relative">
          <Input
            value={maskCep(value.zipcode ?? "")}
            onChange={(e) => onChange({ ...value, zipcode: e.target.value.replace(/\D/g, "") })}
            placeholder="00000-000"
            inputMode="numeric"
            aria-invalid={!!cepError}
            className={cepError ? "border-red-500 focus-visible:ring-red-500" : ""}
          />
          {cepLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-zinc-400" />
          )}
        </div>
      </Field>
      <Field label="Telefone">
        <Input
          value={value.phone ?? ""}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
        />
      </Field>

      <div className="sm:col-span-2">
        <Field label="Rua">
          <Input
            value={value.street ?? ""}
            onChange={(e) => onChange({ ...value, street: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Número *">
        <Input
          ref={numberRef}
          required
          value={value.number ?? ""}
          onChange={(e) => onChange({ ...value, number: e.target.value })}
        />
      </Field>
      <Field label="Complemento">
        <Input
          value={value.complement ?? ""}
          onChange={(e) => onChange({ ...value, complement: e.target.value })}
        />
      </Field>
      <Field label="Bairro">
        <Input
          value={value.district ?? ""}
          onChange={(e) => onChange({ ...value, district: e.target.value })}
        />
      </Field>
      <Field label="Cidade">
        <Input
          value={value.city ?? ""}
          onChange={(e) => onChange({ ...value, city: e.target.value })}
        />
      </Field>
      <Field label="Estado">
        <Input
          value={value.state ?? ""}
          onChange={(e) => onChange({ ...value, state: e.target.value })}
          maxLength={2}
        />
      </Field>
      <Field label="País">
        <Input
          value={value.country ?? "BR"}
          onChange={(e) => onChange({ ...value, country: e.target.value })}
          maxLength={2}
        />
      </Field>

      <label className="sm:col-span-2 flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={!!value.is_default_shipping}
          onChange={(e) => onChange({ ...value, is_default_shipping: e.target.checked })}
        />
        Definir como endereço padrão de entrega
      </label>

      {showShippingQuote && cepDigits.length === 8 && (
        <div className="sm:col-span-2 mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <Truck className="h-4 w-4" /> Opções de frete
            {quoteMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          {quoteMut.data?.error && (
            <p className="text-xs text-red-600 mt-2">{quoteMut.data.error}</p>
          )}
          {!quoteMut.isPending && quoteMut.data?.quotes?.length === 0 && !quoteMut.data?.error && (
            <p className="text-xs text-zinc-500 mt-2">Nenhuma opção disponível.</p>
          )}
          <ul className="mt-2 divide-y divide-zinc-200">
            {(quoteMut.data?.quotes ?? []).map((q: any) => (
              <li key={q.service_code} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-zinc-900">{q.service_name}</p>
                  <p className="text-xs text-zinc-500">
                    {q.carrier_name}
                    {q.estimated_days_max
                      ? ` · ${q.estimated_days_min ?? q.estimated_days_max}-${q.estimated_days_max} dias`
                      : ""}
                  </p>
                </div>
                <p className="font-medium text-zinc-900">
                  {q.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              </li>
            ))}
          </ul>
          {!quoteMut.data && !quoteMut.isPending && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => quoteMut.mutate(cepDigits)}
            >
              Calcular frete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs text-zinc-600">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

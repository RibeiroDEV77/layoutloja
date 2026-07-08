import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useStorefrontCustomer } from "@/hooks/use-storefront-customer";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateMyProfile } from "@/lib/business/storefront-account.functions";

export const Route = createFileRoute("/minha-conta/dados")({
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useStorefrontCustomer();
  const { ctx } = useAuth();
  const userId = ctx?.authenticated ? ctx.user_id : undefined;
  const qc = useQueryClient();
  const update = useServerFn(updateMyProfile);

  const [form, setForm] = useState({
    name: "", phone: "", birth_date: "", doc_number: "", marketing_opt_in: false,
  });

  useEffect(() => {
    if (data?.customer) {
      setForm({
        name: data.customer.name ?? "",
        phone: data.customer.phone ?? "",
        birth_date: data.customer.birth_date ?? "",
        doc_number: data.customer.doc_number ?? "",
        marketing_opt_in: !!data.customer.marketing_opt_in,
      });
    }
  }, [data?.customer]);

  const save = useMutation({
    mutationFn: () => update({ data: form }),
    onSuccess: () => {
      toast.success("Dados atualizados");
      qc.invalidateQueries({ queryKey: ["storefront", "my-account"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold text-zinc-900">Dados pessoais</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div>
          <Label>Nome completo</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Data de nascimento</Label>
            <Input type="date" value={form.birth_date ?? ""} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>CPF</Label>
          <Input value={form.doc_number} onChange={(e) => setForm({ ...form, doc_number: e.target.value })} placeholder="000.000.000-00" />
          <p className="text-xs text-zinc-500 mt-1">Armazenado de forma criptografada.</p>
        </div>
        <div>
          <Label className="text-sm text-zinc-600">E-mail</Label>
          <Input value={data?.customer.email ?? ""} disabled />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.marketing_opt_in}
            onChange={(e) => setForm({ ...form, marketing_opt_in: e.target.checked })}
          />
          Aceito receber novidades e promoções por e-mail
        </label>
        <Button type="submit" disabled={save.isPending}>Salvar alterações</Button>
      </form>
    </div>
  );
}

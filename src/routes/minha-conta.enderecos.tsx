import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { useStorefrontCustomer } from "@/hooks/use-storefront-customer";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  upsertMyAddress, deleteMyAddress,
} from "@/lib/business/storefront-account.functions";
import { AddressForm, type AddressFormValue } from "@/components/storefront/address-form";

export const Route = createFileRoute("/minha-conta/enderecos")({
  component: AddressesPage,
});

const empty = {
  id: undefined as string | undefined,
  label: "", type: "residencial" as const,
  recipient: "", zipcode: "", street: "", number: "", complement: "",
  district: "", city: "", state: "", country: "BR", phone: "",
  reference: "", is_default_shipping: false, is_default_billing: false,
};

function AddressesPage() {
  const { data, refetch } = useStorefrontCustomer();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<typeof empty | null>(null);
  const upsert = useServerFn(upsertMyAddress);
  const del = useServerFn(deleteMyAddress);

  const save = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => {
      toast.success("Endereço salvo");
      setEditing(null);
      refetch();
      qc.invalidateQueries({ queryKey: ["storefront", "my-account"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Endereço removido");
      refetch();
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900">Endereços</h2>
        <Button onClick={() => setEditing(empty)}>
          <Plus className="h-4 w-4 mr-2" /> Novo endereço
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(data?.addresses ?? []).map((a: any) => (
          <div key={a.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  {a.label || a.recipient || "Endereço"}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {[a.street, a.number, a.complement].filter(Boolean).join(", ")}
                </p>
                <p className="text-xs text-zinc-500">
                  {[a.district, a.city, a.state, a.zipcode].filter(Boolean).join(" · ")}
                </p>
                {(a.is_default_shipping || a.is_default_billing) && (
                  <p className="text-[11px] mt-2 text-emerald-600">
                    {a.is_default_shipping ? "Padrão entrega" : ""}
                    {a.is_default_shipping && a.is_default_billing ? " · " : ""}
                    {a.is_default_billing ? "Padrão cobrança" : ""}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing({ ...empty, ...a })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {(!data?.addresses || data.addresses.length === 0) && (
          <p className="text-sm text-zinc-500 col-span-full">Nenhum endereço cadastrado.</p>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar endereço" : "Novo endereço"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editing.number) {
                  toast.error("Informe o número");
                  return;
                }
                save.mutate(editing);
              }}
            >
              <AddressForm
                value={editing as AddressFormValue}
                onChange={(v) => setEditing({ ...empty, ...editing, ...v } as typeof empty)}
              />
              <DialogFooter className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button type="submit" disabled={save.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


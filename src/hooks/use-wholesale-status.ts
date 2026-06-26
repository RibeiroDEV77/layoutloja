/**
 * useWholesaleStatus (Sprint 10) — wrapper de leitura sobre o serviço
 * `listWholesaleApplicationsByCustomer`. Centraliza a derivação dos estados
 * do Portal Atacado (visitante, sem solicitação, em análise, reprovado,
 * aprovado) consumidos pela Top Bar e pela rota `/atacado`.
 *
 * Não duplica regra de negócio: apenas projeta a resposta da camada de
 * serviços já existente.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useStorefrontCustomer } from "@/hooks/use-storefront-customer";
import { listWholesaleApplicationsByCustomer } from "@/lib/business/wholesale-applications.functions";

export type WholesaleAppStatus =
  | "draft" | "submitted" | "in_review" | "approved" | "rejected" | "cancelled";

export interface WholesaleApplication {
  id: string;
  status: WholesaleAppStatus;
  submitted_at: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  created_at: string;
}

const OPEN: WholesaleAppStatus[] = ["draft", "submitted", "in_review"];

export function useWholesaleStatus() {
  const { data: account, isLoading: loadingAccount } = useStorefrontCustomer();
  const customerId = account?.customer?.id;
  const fetchList = useServerFn(listWholesaleApplicationsByCustomer);

  const q = useQuery({
    queryKey: ["wholesale", "list", customerId],
    queryFn: async () => {
      const res = (await fetchList({ data: { customer_id: customerId! } })) as unknown;
      const list =
        res && typeof res === "object" && "ok" in res
          ? ((res as { ok: boolean; data?: WholesaleApplication[] }).data ?? [])
          : ((res as WholesaleApplication[]) ?? []);
      return list as WholesaleApplication[];
    },
    enabled: !!customerId,
    staleTime: 30_000,
  });

  const list = q.data ?? [];
  const latest = list[0] ?? null;
  const isApproved = list.some((a) => a.status === "approved");
  const hasOpen = list.some((a) => OPEN.includes(a.status));
  const isRejected = !isApproved && !hasOpen && latest?.status === "rejected";

  return {
    customerId,
    authenticated: !!customerId,
    loading: loadingAccount || (!!customerId && q.isLoading),
    latest,
    list,
    isApproved,
    hasOpen,
    isRejected,
    refetch: q.refetch,
  };
}

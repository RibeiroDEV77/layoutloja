import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyAccount } from "@/lib/business/storefront-account.functions";

/**
 * P8: chave privada por usuário — evita reuso de cache entre usuários.
 * A query só executa quando há user_id autenticado.
 */
export function useStorefrontCustomer() {
  const { ctx } = useAuth();
  const userId = ctx?.authenticated ? ctx.user_id : undefined;
  const fetchAccount = useServerFn(getMyAccount);
  return useQuery({
    queryKey: ["account", userId ?? "anon", "profile"],
    queryFn: () => fetchAccount(),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export const ACCOUNT_SHEET_EVENT = "storefront:account-sheet";
export function openAccountSheet() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACCOUNT_SHEET_EVENT));
}

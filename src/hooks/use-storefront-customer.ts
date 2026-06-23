import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyAccount } from "@/lib/business/storefront-account.functions";

export function useStorefrontCustomer() {
  const { ctx } = useAuth();
  const authenticated = !!ctx?.authenticated;
  const fetchAccount = useServerFn(getMyAccount);
  return useQuery({
    queryKey: ["storefront", "my-account"],
    queryFn: () => fetchAccount(),
    enabled: authenticated,
    staleTime: 60_000,
  });
}

export const ACCOUNT_SHEET_EVENT = "storefront:account-sheet";
export function openAccountSheet() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACCOUNT_SHEET_EVENT));
}

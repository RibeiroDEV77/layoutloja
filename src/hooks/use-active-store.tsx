import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type StoreOption = { id: string; name: string; slug: string };

type Ctx = {
  loading: boolean;
  stores: StoreOption[];
  storeId: string | null;
  setStoreId: (id: string) => void;
};

const ActiveStoreCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "lovable.activeStoreId";

export function ActiveStoreProvider({ children }: { children: ReactNode }) {
  const { ctx } = useAuth();
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storeId, setStoreIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug")
        .order("name", { ascending: true });
      if (!active) return;
      if (error) {
        console.error("[active-store] load failed", error);
        setStores([]);
      } else {
        setStores((data ?? []) as StoreOption[]);
      }
      const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const userStores = (ctx?.stores as string[] | undefined) ?? [];
      const fallback = userStores[0] ?? (data?.[0]?.id ?? null);
      const valid = saved && (data ?? []).some((s) => s.id === saved) ? saved : fallback;
      setStoreIdState(valid);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [ctx?.user_id]);

  const setStoreId = (id: string) => {
    setStoreIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <ActiveStoreCtx.Provider value={{ loading, stores, storeId, setStoreId }}>
      {children}
    </ActiveStoreCtx.Provider>
  );
}

export function useActiveStore() {
  const v = useContext(ActiveStoreCtx);
  if (!v) throw new Error("useActiveStore must be used within ActiveStoreProvider");
  return v;
}

/**
 * SalesChannelProvider (Sprint 8) — contexto global do canal comercial ativo
 * (RETAIL | WHOLESALE). Persistido em localStorage.
 *
 * Toda a aplicação continua, por padrão, em `retail`. Apenas o disparo
 * explícito de `setChannel('wholesale')` (ex.: botão Atacado na navbar)
 * troca o contexto.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import type { SalesChannel } from '@/hooks/use-storefront-cart';
import { useStorefrontCustomer, openAccountSheet } from '@/hooks/use-storefront-customer';
import { listWholesaleApplicationsByCustomer } from '@/lib/business/wholesale-applications.functions';

const STORAGE_KEY = 'storefront.sales_channel';

type SalesChannelContextValue = {
  channel: SalesChannel;
  setChannel: (c: SalesChannel) => void;
};

const SalesChannelContext = createContext<SalesChannelContextValue | null>(null);

function readInitialChannel(): SalesChannel {
  if (typeof window === 'undefined') return 'retail';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'wholesale' ? 'wholesale' : 'retail';
}

export function SalesChannelProvider({ children }: { children: ReactNode }) {
  const [channel, setChannelState] = useState<SalesChannel>('retail');

  // Hydrate from localStorage no client (mantém o canal entre refreshes).
  useEffect(() => {
    setChannelState(readInitialChannel());
  }, []);

  const setChannel = useCallback((c: SalesChannel) => {
    setChannelState(c);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, c);
    }
  }, []);

  const value = useMemo(() => ({ channel, setChannel }), [channel, setChannel]);
  return <SalesChannelContext.Provider value={value}>{children}</SalesChannelContext.Provider>;
}

export function useSalesChannel(): SalesChannelContextValue {
  const ctx = useContext(SalesChannelContext);
  if (!ctx) throw new Error('useSalesChannel deve ser usado dentro de <SalesChannelProvider>');
  return ctx;
}

/**
 * Hook utilitário usado pelo botão "Atacado":
 *   - Visitante  → abre o sheet de login.
 *   - Sem aprovação → /atacado.
 *   - Aprovado → ativa o canal WHOLESALE e leva para a home.
 *
 * Também expõe `goRetail()` para retorno simples ao varejo.
 */
export function useEnterWholesale() {
  const { setChannel } = useSalesChannel();
  const { data: customer } = useStorefrontCustomer();
  const navigate = useNavigate();
  const fetchApplications = useServerFn(listWholesaleApplicationsByCustomer);

  const enterWholesale = useCallback(async () => {
    const customerId = customer?.customer?.id;
    if (!customerId) {
      openAccountSheet();
      return;
    }
    try {
      const res = await fetchApplications({ data: { customer_id: customerId } }) as unknown;
      const list = (res && typeof res === 'object' && 'ok' in res
        ? (res as { ok: boolean; data?: Array<{ status: string }> }).data ?? []
        : (res as Array<{ status: string }>)) ?? [];
      const approved = Array.isArray(list) && list.some((a) => a.status === 'approved');
      if (!approved) {
        await navigate({ to: '/atacado' });
        return;
      }
      setChannel('wholesale');
      await navigate({ to: '/' });
    } catch {
      await navigate({ to: '/atacado' });
    }
  }, [customer, fetchApplications, navigate, setChannel]);

  const goRetail = useCallback(async () => {
    setChannel('retail');
    await navigate({ to: '/' });
  }, [navigate, setChannel]);

  return { enterWholesale, goRetail };
}

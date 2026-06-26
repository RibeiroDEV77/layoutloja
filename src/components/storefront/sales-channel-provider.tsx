/**
 * SalesChannelProvider — contexto global do canal comercial ativo
 * (RETAIL | WHOLESALE).
 *
 * Sprint 10.5: persistido em **cookie** (`lv_sales_channel`) para que
 * as Server Functions (SSR) enxerguem o canal corretamente, eliminando
 * a divergência SSR/CSR. O `localStorage` é mantido como fallback de
 * leitura para hidratar usuários anteriores ao cookie.
 *
 * Ao trocar de canal, `router.invalidate()` é disparado para que todos
 * os loaders ativos re-executem com o novo contexto comercial — sem
 * duplicar regra de negócio nem alterar nenhuma interface.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import {
  DEFAULT_SALES_CHANNEL,
  SALES_CHANNEL_STORAGE_KEY,
  normalizeSalesChannel,
  readSalesChannelCookieBrowser,
  writeSalesChannelCookieBrowser,
  type SalesChannel,
} from '@/lib/business/sales-channel';
import { useStorefrontCustomer, openAccountSheet } from '@/hooks/use-storefront-customer';
import { useAuth } from '@/hooks/use-auth';
import { listWholesaleApplicationsByCustomer } from '@/lib/business/wholesale-applications.functions';

export type { SalesChannel } from '@/lib/business/sales-channel';

type SalesChannelContextValue = {
  channel: SalesChannel;
  setChannel: (c: SalesChannel) => void;
};

const SalesChannelContext = createContext<SalesChannelContextValue | null>(null);

export function SalesChannelProvider({ children }: { children: ReactNode }) {
  const [channel, setChannelState] = useState<SalesChannel>(DEFAULT_SALES_CHANNEL);
  const router = useRouter();
  const hydratedRef = useRef(false);

  // Hidrata a partir do cookie (preferido) ou do localStorage (legado).
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const fromCookie = readSalesChannelCookieBrowser();
    let resolved: SalesChannel | null = fromCookie;
    if (!resolved && typeof window !== 'undefined') {
      const legacy = window.localStorage.getItem(SALES_CHANNEL_STORAGE_KEY);
      if (legacy === 'wholesale' || legacy === 'retail') {
        resolved = normalizeSalesChannel(legacy);
        writeSalesChannelCookieBrowser(resolved); // migra para cookie
      }
    }
    if (resolved && resolved !== channel) {
      setChannelState(resolved);
      // O SSR renderizou com 'retail' (sem cookie) — força loaders a
      // re-executarem com o canal correto.
      void router.invalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setChannel = useCallback((c: SalesChannel) => {
    const next = normalizeSalesChannel(c);
    setChannelState(next);
    writeSalesChannelCookieBrowser(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SALES_CHANNEL_STORAGE_KEY, next); // mantém legado em sincronia
    }
    void router.invalidate();
  }, [router]);

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
 *   - Aprovado → ativa o canal WHOLESALE e leva para a home do atacado.
 */
export function useEnterWholesale() {
  const { setChannel } = useSalesChannel();
  const { ctx, loading, session, user } = useAuth();
  const customerQuery = useStorefrontCustomer();
  const customer = customerQuery.data;
  const navigate = useNavigate();
  const fetchApplications = useServerFn(listWholesaleApplicationsByCustomer);

  const enterWholesale = useCallback(async () => {
    const authenticated = !loading && (!!ctx?.authenticated || !!session?.user || !!user);
    console.log('[WholesaleNavigation] enterWholesale()', {
      loading,
      authenticated,
      ctxAuthenticated: ctx?.authenticated,
      authUserId: ctx?.user_id ?? user?.id ?? session?.user?.id ?? null,
      customer: customer?.customer ?? null,
      customerStatus: customerQuery.status,
    });

    if (loading) {
      console.log('[WholesaleNavigation] auth loading; navigation deferred');
      return;
    }

    // Decisão de login baseada no estado de autenticação real (useAuth),
    // não na presença do registro de customer (que pode ainda estar
    // carregando ou inexistente para um usuário recém-criado).
    if (!authenticated) {
      console.log('[WholesaleNavigation] openAccountSheet()', {
        reason: 'unauthenticated',
        requestStatus: null,
      });
      openAccountSheet();
      return;
    }
    const customerId = customer?.customer?.id;
    if (!customerId) {
      // Autenticado, mas ainda sem perfil de customer → segue para o portal.
      console.log("[WholesaleNavigation] navigate('/atacado')", {
        reason: 'authenticated_without_customer',
        requestStatus: null,
      });
      await navigate({ to: '/atacado' });
      return;
    }
    try {
      const res = await fetchApplications({ data: { customer_id: customerId } }) as unknown;
      const list = (res && typeof res === 'object' && 'ok' in res
        ? (res as { ok: boolean; data?: Array<{ status: string }> }).data ?? []
        : (res as Array<{ status: string }>)) ?? [];
      const approved = Array.isArray(list) && list.some((a) => a.status === 'approved');
      const requestStatus = Array.isArray(list) ? (list[0]?.status ?? null) : null;
      console.log('[WholesaleNavigation] wholesale application status', {
        customerId,
        requestStatus,
        statuses: Array.isArray(list) ? list.map((a) => a.status) : [],
        approved,
      });
      if (!approved) {
        console.log("[WholesaleNavigation] navigate('/atacado')", {
          reason: 'not_approved_or_no_request',
          requestStatus,
        });
        await navigate({ to: '/atacado' });
        return;
      }
      setChannel('wholesale');
      console.log("[WholesaleNavigation] navigate('/atacado/home')", {
        reason: 'approved',
        requestStatus,
      });
      await navigate({ to: '/atacado/home' });
    } catch (error) {
      console.log("[WholesaleNavigation] navigate('/atacado')", {
        reason: 'application_lookup_failed',
        error,
      });
      await navigate({ to: '/atacado' });
    }
  }, [ctx?.authenticated, ctx?.user_id, customer, customerQuery.status, fetchApplications, loading, navigate, session?.user, setChannel, user]);


  const goRetail = useCallback(async () => {
    setChannel('retail');
    await navigate({ to: '/' });
  }, [navigate, setChannel]);

  return { enterWholesale, goRetail };
}

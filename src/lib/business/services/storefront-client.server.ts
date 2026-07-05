/**
 * Storefront Supabase client (server-only).
 *
 * Retorna um cliente Supabase que:
 *  - Usa a chave publishable (nunca a service role);
 *  - Encaminha o `Authorization: Bearer <token>` da requisição atual quando
 *    presente, para que as políticas RLS `TO authenticated` sejam avaliadas
 *    (ex.: leitura da Tabela Atacado por cliente aprovado).
 *  - Cai automaticamente para o modo anônimo quando não há token — visitantes
 *    continuam sem acesso a tabelas privadas.
 *
 * Este helper NÃO altera comportamento de catálogo/RLS existente: apenas
 * habilita RLS `authenticated` quando o usuário já está logado.
 */
import { getRequest } from '@tanstack/react-start/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export function storefrontClient(): SupabaseClient<Database> {
  let bearer: string | null = null;
  try {
    const req = getRequest();
    const h = req?.headers?.get('authorization') ?? null;
    if (h && h.toLowerCase().startsWith('bearer ')) bearer = h;
  } catch {
    // Fora de contexto de requisição — segue como anônimo.
  }
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: bearer ? { headers: { Authorization: bearer } } : undefined,
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

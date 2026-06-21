import { createFileRoute } from "@tanstack/react-router";
import { AdminInfoPage } from "@/components/admin/admin-info-page";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Configurações — Admin" }] }),
  component: () => (
    <AdminInfoPage
      title="Configurações"
      description="Dados gerais, SEO, e-mail, integrações (Mercado Pago, Correios, Melhor Envio, Nuvem Fiscal) e Feature Flags."
      breadcrumbs={[{ label: "Administração" }, { label: "Configurações" }]}
      status="deferred"
      statusLabel="Backend pronto — UI consolidada agendada para Fase C"
      blockers={[
        "Tabelas store_settings, system_settings, feature_flags e feature_flag_overrides já existem.",
        "Server fns upsertStoreSetting e listStoreSettings já implementadas em src/lib/business/stores.functions.ts.",
        "Falta UI com abas: Geral (system_settings) / Loja (store_settings por chave) / Feature Flags (CRUD + overrides) / Integrações (links para configurar adapters).",
        "Integrações Mercado Pago, Correios, Melhor Envio e Nuvem Fiscal exigem credenciais via keyrings (payment_credentials_keyring, shipping_credentials_keyring, fiscal_credentials_keyring) — interface de configuração é da Fase D.",
      ]}
    />
  ),
});

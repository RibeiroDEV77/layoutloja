import { createFileRoute } from "@tanstack/react-router";
import { AdminInfoPage } from "@/components/admin/admin-info-page";

export const Route = createFileRoute("/_authenticated/admin/marketing")({
  head: () => ({ meta: [{ title: "Marketing — Admin" }] }),
  component: () => (
    <AdminInfoPage
      title="Marketing"
      description="Cupons, campanhas e automações."
      breadcrumbs={[{ label: "Marketing" }]}
      status="deferred"
      statusLabel="Cupons já disponíveis — Campanhas e Automações na Fase D"
      blockers={[
        "Cupons já têm CRUD completo na rota /admin/coupons (tabela coupons + redemptions).",
        "Campanhas (e-mail, push, banners segmentados) exigem tabelas campaigns + campaign_segments + delivery_jobs — modelagem não iniciada.",
        "Automações (workflows de marketing como abandono de carrinho) podem reusar workflow_definitions + event_outbox; falta apenas o catálogo de triggers/ações.",
        "Antes de implementar: definir qual provedor de envio (SES, SendGrid, Resend) e segmentação mínima.",
      ]}
      alternatives={[
        { label: "Gerenciar cupons", to: "/admin/coupons" },
        { label: "Listas de preço", to: "/admin/price-lists" },
      ]}
    />
  ),
});

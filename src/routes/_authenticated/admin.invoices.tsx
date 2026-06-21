import { createFileRoute } from "@tanstack/react-router";
import { AdminInfoPage } from "@/components/admin/admin-info-page";

export const Route = createFileRoute("/_authenticated/admin/invoices")({
  head: () => ({ meta: [{ title: "Notas Fiscais — Admin" }] }),
  component: () => (
    <AdminInfoPage
      title="Notas Fiscais"
      description="Emissão, consulta, XML, DANFE, cancelamento, carta de correção e timeline."
      breadcrumbs={[{ label: "Expedição & Fiscal" }, { label: "Notas Fiscais" }]}
      status="deferred"
      statusLabel="Backend pronto — UI agendada para Fase B/D"
      blockers={[
        "Tabelas fiscal_invoices, fiscal_invoice_events, fiscal_providers e fiscal_webhook_inbox já existem.",
        "Server functions requestInvoice / cancelInvoice / issueCorrectionLetter / consultInvoice / downloadInvoiceXML / downloadInvoiceDANFE já implementadas em src/lib/business/fiscal.functions.ts.",
        "Falta UI de listagem (listInvoices server fn ainda não criada) + tela de detalhes com timeline + botões para invocar as fns existentes.",
        "Para emissão real é necessário cadastrar provedor (Nuvem Fiscal, Focus NFe, etc.) com credenciais via setFiscalProviderCredentials.",
      ]}
      alternatives={[
        { label: "Pedidos", to: "/admin/orders" },
      ]}
    />
  ),
});

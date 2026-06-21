import { createFileRoute } from "@tanstack/react-router";
import { AdminInfoPage } from "@/components/admin/admin-info-page";

export const Route = createFileRoute("/_authenticated/admin/purchases")({
  head: () => ({ meta: [{ title: "Compras — Admin" }] }),
  component: () => (
    <AdminInfoPage
      title="Compras"
      description="Pedidos de compra, recebimento e integração com estoque."
      breadcrumbs={[{ label: "Estoque & Compras" }, { label: "Compras" }]}
      status="deferred"
      statusLabel="Backend pronto — UI agendada para Fase B"
      blockers={[
        "Tabelas purchase_orders, purchase_order_items e goods_receipts já existem.",
        "Server functions createPurchaseOrder / approvePurchaseOrder / cancelPurchaseOrder / receivePurchaseOrder já implementadas em src/lib/business/purchases.functions.ts.",
        "Falta apenas a UI: listagem paginada, wizard de criação (selecionar fornecedor → itens → totais), tela de recebimento com lançamento em stock_movements.",
        "Reusa MasterCrudPage + service de listagem (a ser adicionado: listPurchaseOrders).",
      ]}
      alternatives={[
        { label: "Fornecedores", to: "/admin/suppliers" },
        { label: "Estoque", to: "/admin/inventory" },
      ]}
    />
  ),
});

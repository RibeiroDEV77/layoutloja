import { createFileRoute } from "@tanstack/react-router";
import { AdminInfoPage } from "@/components/admin/admin-info-page";

export const Route = createFileRoute("/_authenticated/admin/companies")({
  head: () => ({ meta: [{ title: "Empresas — Admin" }] }),
  component: () => (
    <AdminInfoPage
      title="Empresas"
      description="Cadastro de empresas (pessoa jurídica) com filiais e dados fiscais."
      breadcrumbs={[{ label: "Vendas" }, { label: "Empresas" }]}
      status="needs-modeling"
      statusLabel="Aguardando modelagem de dados"
      blockers={[
        "Não existe tabela companies no banco. Hoje 'pessoa jurídica' é representada como customer com kind='legal'.",
        "Definir se Empresas é uma entidade nova (com filiais, hierarquia, contratos) ou se será apenas uma view filtrada de customers.",
        "Decisão de domínio bloqueia: criar tabela companies + branches, ou estender customers com is_company / parent_company_id.",
        "Após decisão de modelagem, criar migration + service + functions seguindo o padrão de Suppliers/Customers já existente.",
      ]}
      alternatives={[
        { label: "Ver clientes (PJ incluídos)", to: "/admin/customers" },
        { label: "Ver fornecedores", to: "/admin/suppliers" },
      ]}
    />
  ),
});

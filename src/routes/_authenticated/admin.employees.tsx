import { createFileRoute } from "@tanstack/react-router";
import { AdminInfoPage } from "@/components/admin/admin-info-page";

export const Route = createFileRoute("/_authenticated/admin/employees")({
  head: () => ({ meta: [{ title: "Funcionários — Admin" }] }),
  component: () => (
    <AdminInfoPage
      title="Funcionários"
      description="Cadastro de funcionários, cargos, permissões e lojas vinculadas."
      breadcrumbs={[{ label: "Administração" }, { label: "Funcionários" }]}
      status="use-other"
      statusLabel="Funcionalidade disponível como Usuários & Papéis"
      blockers={[
        "Funcionário = usuário com papéis em uma ou mais lojas. Toda a infraestrutura já existe em profiles + user_roles + roles.",
        "Para uma entidade Funcionário separada (com dados de RH como CPF, admissão, salário, ponto), é necessário criar tabela employees vinculada a profiles.",
        "Decisão pendente: o sistema é PDV/e-commerce ou também faz gestão de RH? Hoje só atende o primeiro caso.",
      ]}
      alternatives={[
        { label: "Gerenciar usuários e papéis", to: "/admin/users" },
      ]}
    />
  ),
});

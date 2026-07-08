import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2, Sparkles, TrendingUp, Truck, ShieldCheck, ChevronDown,
  Loader2, Tag, Package, Headphones, ArrowRight, Clock, XCircle,
} from "lucide-react";

import { StorefrontShell } from "@/components/storefront/storefront";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import {
  useStorefrontCustomer,
  openAccountSheet,
} from "@/hooks/use-storefront-customer";
import { useWholesaleStatus, type WholesaleAppStatus } from "@/hooks/use-wholesale-status";
import { useEnterWholesale } from "@/components/storefront/sales-channel-provider";
import { createWholesaleApplication } from "@/lib/business/wholesale-applications.functions";
import { updateMyProfile } from "@/lib/business/storefront-account.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/atacado/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Canal Atacado — Layout" },
      {
        name: "description",
        content:
          "Solicite acesso ao Canal Atacado da Layout: programa exclusivo para lojistas, revendedores e empresas com preços e condições diferenciadas.",
      },
      { property: "og:title", content: "Canal Atacado — Layout" },
      {
        property: "og:description",
        content:
          "Programa exclusivo para lojistas e revendedores. Solicite seu acesso ao Canal Atacado da Layout.",
      },
    ],
  }),
  component: AtacadoPortal,
});

type PersonType = "pf" | "pj";

const STATUS_LABEL: Record<WholesaleAppStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviada — aguardando análise",
  in_review: "Em análise",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

function AtacadoPortal() {
  const [openForm, setOpenForm] = useState(false);
  return (
    <StorefrontShell>
      <PortalHero onCta={() => setOpenForm(true)} />
      <PortalBenefits />
      <PortalHowItWorks />
      <PortalFaq />
      <ApplicationDialog open={openForm} onClose={() => setOpenForm(false)} />
    </StorefrontShell>
  );
}

// ---------------- Hero (cabeçalho institucional + estado dinâmico) ----------------

function PortalHero({ onCta }: { onCta: () => void }) {
  const { ctx, loading: loadingAuth } = useAuth();
  const authed = !!ctx?.authenticated;
  const { loading, latest, isApproved, hasOpen, isRejected } = useWholesaleStatus();
  const { enterWholesale } = useEnterWholesale();

  return (
    <section className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-br from-zinc-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
            <Sparkles className="h-3.5 w-3.5" /> Programa exclusivo
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl">
            Canal Atacado
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Solicite acesso ao nosso programa exclusivo para lojistas, revendedores e empresas.
          </p>

          <div className="mt-8">
            {loadingAuth || (authed && loading) ? (
              <div className="inline-flex items-center text-sm text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : !authed ? (
              <StateVisitor onLogin={openAccountSheet} />
            ) : isApproved ? (
              <StateApproved onEnter={() => void enterWholesale()} />
            ) : hasOpen ? (
              <StatePending latest={latest} />
            ) : isRejected ? (
              <StateRejected latest={latest} onCta={onCta} />
            ) : (
              <StateAuthedNoApp onCta={onCta} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// Estado 1 — Visitante
function StateVisitor({ onLogin }: { onLogin: () => void }) {
  return (
    <Button size="lg" onClick={onLogin} className="bg-zinc-900 text-white hover:bg-zinc-800">
      Entrar para solicitar acesso
    </Button>
  );
}

// Estado 2 — Autenticado sem solicitação
function StateAuthedNoApp({ onCta }: { onCta: () => void }) {
  return (
    <Button size="lg" onClick={onCta} className="bg-zinc-900 text-white hover:bg-zinc-800">
      Solicitar acesso <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  );
}

// Estado 3 — Solicitação em análise
function StatePending({ latest }: { latest: { status: WholesaleAppStatus; submitted_at: string | null; created_at: string } | null }) {
  const when = latest?.submitted_at ?? latest?.created_at ?? null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm">
      <div className="flex items-center gap-2 font-medium text-amber-900">
        <Clock className="h-4 w-4" /> Sua solicitação está em análise
      </div>
      <dl className="mt-3 space-y-1 text-amber-900/90">
        <div className="flex gap-2">
          <dt className="text-amber-800/70">Status:</dt>
          <dd className="font-medium">{latest ? STATUS_LABEL[latest.status] : "-"}</dd>
        </div>
        {when && (
          <div className="flex gap-2">
            <dt className="text-amber-800/70">Enviada em:</dt>
            <dd className="font-medium">{new Date(when).toLocaleDateString("pt-BR")}</dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-amber-900/80">
        Nossa equipe está avaliando seus dados. Você será notificado assim que houver uma decisão.
      </p>
    </div>
  );
}

// Estado — Reprovado (variação institucional do fluxo)
function StateRejected({
  latest, onCta,
}: { latest: { decision_reason: string | null } | null; onCta: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm">
        <div className="flex items-center gap-2 font-medium text-red-900">
          <XCircle className="h-4 w-4" /> Sua solicitação não foi aprovada
        </div>
        {latest?.decision_reason && (
          <p className="mt-2 text-red-900/90">
            <span className="text-red-800/70">Motivo:</span>{" "}
            <span className="font-medium">{latest.decision_reason}</span>
          </p>
        )}
        <p className="mt-2 text-red-900/80">
          Você pode revisar suas informações e enviar uma nova solicitação.
        </p>
      </div>
      <Button size="lg" onClick={onCta} className="bg-zinc-900 text-white hover:bg-zinc-800">
        Enviar nova solicitação
      </Button>
    </div>
  );
}

// Estado 4 — Aprovado
function StateApproved({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm">
        <div className="flex items-center gap-2 font-medium text-emerald-900">
          <CheckCircle2 className="h-4 w-4" /> Seu acesso ao Canal Atacado foi aprovado.
        </div>
      </div>
      <Button size="lg" onClick={onEnter} className="bg-emerald-600 text-white hover:bg-emerald-700">
        Entrar no Canal Atacado <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// ---------------- Benefícios ----------------
function PortalBenefits() {
  const items = [
    { icon: Tag, title: "Preços exclusivos", desc: "Tabela exclusiva para lojistas com margem competitiva." },
    { icon: Truck, title: "Entrega para todo o Brasil", desc: "Logística pensada para o seu giro." },
    { icon: Package, title: "Mesmo catálogo, condições diferentes", desc: "Acesso ao mix completo com condições comerciais diferenciadas." },
    { icon: Headphones, title: "Atendimento especializado", desc: "Suporte próximo para curadoria e reposição." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
      <h2 className="text-2xl font-semibold text-zinc-900 md:text-3xl">Benefícios</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.title} className="rounded-xl border border-zinc-200 bg-white p-6">
            <it.icon className="h-6 w-6 text-zinc-900" />
            <h3 className="mt-4 font-medium text-zinc-900">{it.title}</h3>
            <p className="mt-1 text-sm text-zinc-600">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------- Como funciona ----------------
function PortalHowItWorks() {
  const steps = [
    { n: 1, title: "Solicite seu cadastro", desc: "Preencha o formulário com os dados do seu negócio.", icon: Sparkles },
    { n: 2, title: "Nossa equipe analisa", desc: "Avaliamos sua solicitação em poucos dias úteis.", icon: ShieldCheck },
    { n: 3, title: "Cadastro aprovado", desc: "Você é notificado e o acesso é liberado.", icon: CheckCircle2 },
    { n: 4, title: "Compre no Canal Atacado", desc: "Navegue com condições comerciais diferenciadas.", icon: TrendingUp },
  ];
  return (
    <section className="border-y border-zinc-200 bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <h2 className="text-2xl font-semibold text-zinc-900 md:text-3xl">Como funciona</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="relative rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                  {s.n}
                </span>
                <s.icon className="h-4 w-4 text-zinc-500" />
              </div>
              <h3 className="mt-4 font-medium text-zinc-900">{s.title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------- FAQ ----------------
function PortalFaq() {
  const items = [
    { q: "Quem pode comprar no atacado?", a: "Lojistas, revendedores e empresas, pessoa física ou jurídica, com atuação compatível com a marca." },
    { q: "Como funciona a aprovação?", a: "Após enviar a solicitação, nossa equipe analisa os dados em poucos dias úteis e libera o acesso ao Canal Atacado quando aprovada." },
    { q: "Existe pedido mínimo?", a: "As condições comerciais — incluindo eventuais pedidos mínimos — são apresentadas após a aprovação do cadastro." },
    { q: "Como acompanho minha solicitação?", a: "Esta página exibe automaticamente o status atual da sua solicitação assim que você entra com sua conta." },
  ];
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 md:px-8">
      <h2 className="text-2xl font-semibold text-zinc-900 md:text-3xl">Perguntas frequentes</h2>
      <div className="mt-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white">
        {items.map((it) => (
          <details key={it.q} className="group p-5">
            <summary className="flex cursor-pointer items-center justify-between text-zinc-900">
              <span className="font-medium">{it.q}</span>
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm text-zinc-600">{it.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ---------------- Application Dialog (reutiliza o serviço existente) ----------------

function ApplicationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ctx, loading } = useAuth();
  const authed = !!ctx?.authenticated;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <div className="absolute inset-0" aria-hidden onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-auto rounded-t-2xl bg-white p-6 shadow-xl md:rounded-2xl md:p-8">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-900"
          aria-label="Fechar"
        >
          ✕
        </button>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : !authed ? (
          <SignInPrompt onClose={onClose} />
        ) : (
          <ApplicationBody onClose={onClose} />
        )}
      </div>
    </div>
  );
}

function SignInPrompt({ onClose }: { onClose: () => void }) {
  return (
    <div className="py-4">
      <h3 className="text-xl font-semibold text-zinc-900">Entre para continuar</h3>
      <p className="mt-2 text-sm text-zinc-600">
        É necessário estar conectado à sua conta para enviar a solicitação de acesso ao Canal Atacado.
      </p>
      <div className="mt-6 flex gap-3">
        <Button
          onClick={() => { onClose(); setTimeout(() => openAccountSheet(), 50); }}
          className="bg-zinc-900 text-white hover:bg-zinc-800"
        >
          Entrar / Criar conta
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
}

function ApplicationBody({ onClose }: { onClose: () => void }) {
  const { data: account, isLoading: loadingAccount } = useStorefrontCustomer();
  const customerId = account?.customer.id;
  const { loading, hasOpen, latest } = useWholesaleStatus();

  if (loadingAccount || loading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  if (hasOpen && latest) {
    return (
      <div className="py-2">
        <h3 className="text-xl font-semibold text-zinc-900">Solicitação em andamento</h3>
        <p className="mt-2 text-sm text-zinc-600">
          Você já possui uma solicitação registrada. Não é possível abrir uma nova enquanto esta não for finalizada.
        </p>
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <span className="text-zinc-500">Status atual:</span>{" "}
          <span className="font-medium text-zinc-900">{STATUS_LABEL[latest.status]}</span>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    );
  }

  return <ApplicationForm customerId={customerId!} defaultName={account?.customer.name ?? ""} onClose={onClose} />;
}

function ApplicationForm({
  customerId, defaultName, onClose,
}: { customerId: string; defaultName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createWholesaleApplication);
  const updateProfileFn = useServerFn(updateMyProfile);

  const [personType, setPersonType] = useState<PersonType>("pf");
  const [name, setName] = useState(defaultName);
  const [cpf, setCpf] = useState("");
  const [razao, setRazao] = useState("");
  const [fantasia, setFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [ie, setIe] = useState("");
  const [responsavel, setResponsavel] = useState(defaultName);
  const [whatsapp, setWhatsapp] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [instagram, setInstagram] = useState("");
  const [site, setSite] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sent, setSent] = useState(false);

  const valid = useMemo(() => {
    if (!whatsapp.trim() || !cidade.trim() || !estado.trim()) return false;
    if (personType === "pf") return name.trim().length > 1 && cpf.replace(/\D/g, "").length >= 11;
    return razao.trim().length > 1 && cnpj.replace(/\D/g, "").length >= 14 && responsavel.trim().length > 1;
  }, [personType, name, cpf, razao, cnpj, responsavel, whatsapp, cidade, estado]);

  const submit = useMutation({
    mutationFn: async () => {
      // Fase A: documento é gravado no customer (encrypted + hash) via
      // updateMyProfile. metadata do wholesale_application NÃO recebe cpf/cnpj.
      const rawDoc = (personType === "pf" ? cpf : cnpj).replace(/\D/g, "");
      if (rawDoc) {
        await updateProfileFn({
          data: {
            name: (personType === "pf" ? name : responsavel).trim() || defaultName || "Cliente",
            phone: whatsapp.trim() || null,
            doc_number: rawDoc,
          },
        });
      }

      const metadata =
        personType === "pf"
          ? {
              person_type: "pf" as const,
              name: name.trim(),
              whatsapp: whatsapp.trim(), city: cidade.trim(), state: estado.trim().toUpperCase(),
              instagram: instagram.trim() || null, website: site.trim() || null,
              message: mensagem.trim() || null,
            }
          : {
              person_type: "pj" as const,
              legal_name: razao.trim(), trade_name: fantasia.trim() || null,
              state_registration: ie.trim() || null,
              contact_name: responsavel.trim(),
              whatsapp: whatsapp.trim(), city: cidade.trim(), state: estado.trim().toUpperCase(),
              instagram: instagram.trim() || null, website: site.trim() || null,
              message: mensagem.trim() || null,
            };
      const res = await createFn({
        data: { customer_id: customerId, submit: true, metadata: metadata as unknown as Record<string, never> },
      });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      setSent(true);
      qc.invalidateQueries({ queryKey: ["wholesale", "list", customerId] });
      qc.invalidateQueries({ queryKey: ["wholesale", "active", customerId] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro ao enviar solicitação"),
  });

  if (sent) {
    return (
      <div className="py-2 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h3 className="mt-4 text-xl font-semibold text-zinc-900">Solicitação recebida</h3>
        <p className="mt-2 text-sm text-zinc-600">
          Recebemos seus dados e sua solicitação está em análise. Em breve nossa equipe entrará em contato.
        </p>
        <div className="mt-6">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (valid) submit.mutate(); }}
      className="space-y-5"
    >
      <header>
        <h3 className="text-xl font-semibold text-zinc-900">Solicitar acesso ao Canal Atacado</h3>
        <p className="mt-1 text-sm text-zinc-600">Preencha os dados do seu negócio. Campos com * são obrigatórios.</p>
      </header>

      <div className="inline-flex rounded-lg border border-zinc-200 p-1 text-sm">
        {(["pf", "pj"] as PersonType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPersonType(t)}
            className={cn(
              "rounded-md px-4 py-1.5 transition",
              personType === t ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900",
            )}
          >
            {t === "pf" ? "Pessoa Física" : "Pessoa Jurídica"}
          </button>
        ))}
      </div>

      {personType === "pf" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Nome completo *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          </div>
          <div>
            <Label>CPF *</Label>
            <Input value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={20} placeholder="000.000.000-00" required />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Razão Social *</Label>
            <Input value={razao} onChange={(e) => setRazao(e.target.value)} maxLength={150} required />
          </div>
          <div>
            <Label>Nome Fantasia</Label>
            <Input value={fantasia} onChange={(e) => setFantasia(e.target.value)} maxLength={150} />
          </div>
          <div>
            <Label>CNPJ *</Label>
            <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} maxLength={20} placeholder="00.000.000/0000-00" required />
          </div>
          <div>
            <Label>Inscrição Estadual</Label>
            <Input value={ie} onChange={(e) => setIe(e.target.value)} maxLength={30} />
          </div>
          <div>
            <Label>Responsável *</Label>
            <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} maxLength={120} required />
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>WhatsApp *</Label>
          <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} maxLength={20} placeholder="(00) 00000-0000" required />
        </div>
        <div className="grid grid-cols-[1fr_80px] gap-2">
          <div>
            <Label>Cidade *</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={80} required />
          </div>
          <div>
            <Label>UF *</Label>
            <Input value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} required />
          </div>
        </div>
        <div>
          <Label>Instagram</Label>
          <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} maxLength={80} placeholder="@sualoja" />
        </div>
        <div>
          <Label>Site</Label>
          <Input value={site} onChange={(e) => setSite(e.target.value)} maxLength={200} placeholder="https://" />
        </div>
        <div className="md:col-span-2">
          <Label>Mensagem</Label>
          <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={500} rows={3} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button
          type="submit"
          disabled={!valid || submit.isPending}
          className="bg-zinc-900 text-white hover:bg-zinc-800"
        >
          {submit.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</> : "Enviar solicitação"}
        </Button>
      </div>
    </form>
  );
}

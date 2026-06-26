import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CheckCircle2, Sparkles, TrendingUp, Truck, ShieldCheck, ChevronDown, Loader2,
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
import {
  createWholesaleApplication,
  getActiveWholesaleApplication,
} from "@/lib/business/wholesale-applications.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/atacado")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Atacado — Layout" },
      {
        name: "description",
        content:
          "Programa de Atacado da Layout: condições especiais para lojistas e revendedores. Solicite seu cadastro e comece a comprar com preços de atacado.",
      },
      { property: "og:title", content: "Atacado — Layout" },
      {
        property: "og:description",
        content:
          "Condições especiais para lojistas e revendedores. Solicite seu cadastro no programa de Atacado da Layout.",
      },
    ],
  }),
  component: AtacadoPage,
});

type PersonType = "pf" | "pj";
type Status = "draft" | "submitted" | "in_review" | "approved" | "rejected" | "cancelled";

const STATUS_LABEL: Record<Status, string> = {
  draft: "Rascunho",
  submitted: "Enviada — aguardando análise",
  in_review: "Em análise",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

function AtacadoPage() {
  const [open, setOpen] = useState(false);
  return (
    <StorefrontShell>
      <Hero onCta={() => setOpen(true)} />
      <Benefits />
      <HowItWorks />
      <Faq />
      <CtaBlock onCta={() => setOpen(true)} />
      <ApplicationDialog open={open} onClose={() => setOpen(false)} />
    </StorefrontShell>
  );
}

// ---------------- Sections ----------------
function Hero({ onCta }: { onCta: () => void }) {
  return (
    <section className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-br from-zinc-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
            <Sparkles className="h-3.5 w-3.5" /> Programa Atacado Layout
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-zinc-900 md:text-5xl">
            Compre Layout no Atacado
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Condições especiais para lojistas e revendedores que querem oferecer
            o melhor do estilo country na sua loja física ou online.
          </p>
          <div className="mt-8">
            <Button size="lg" onClick={onCta} className="bg-zinc-900 text-white hover:bg-zinc-800">
              Solicitar Cadastro
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  const items = [
    { icon: TrendingUp, title: "Preços diferenciados", desc: "Tabela exclusiva para lojistas com margem competitiva." },
    { icon: Truck, title: "Logística simplificada", desc: "Envios consolidados e prazos pensados para o seu giro." },
    { icon: ShieldCheck, title: "Marca consolidada", desc: "Produtos com alta saída e identidade reconhecida pelo público country." },
    { icon: CheckCircle2, title: "Suporte dedicado", desc: "Atendimento próximo para curadoria e reposição do mix." },
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

function HowItWorks() {
  const steps = [
    { n: 1, title: "Solicite o cadastro", desc: "Preencha o formulário com os dados do seu negócio." },
    { n: 2, title: "Análise", desc: "Nossa equipe avalia a solicitação em poucos dias úteis." },
    { n: 3, title: "Aprovação", desc: "Você é notificado e o acesso ao atacado é liberado." },
    { n: 4, title: "Compre com preços de atacado", desc: "Navegue na loja com a tabela liberada para o seu perfil." },
  ];
  return (
    <section className="border-y border-zinc-200 bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <h2 className="text-2xl font-semibold text-zinc-900 md:text-3xl">Como funciona</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="rounded-xl border border-zinc-200 bg-white p-6">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                {s.n}
              </span>
              <h3 className="mt-4 font-medium text-zinc-900">{s.title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    { q: "Qual o pedido mínimo?", a: "As condições comerciais são apresentadas após a aprovação do cadastro." },
    { q: "Quem pode se cadastrar?", a: "Lojistas e revendedores, pessoa física ou jurídica, com atuação compatível com a marca." },
    { q: "Quanto tempo leva a análise?", a: "Em média alguns dias úteis. Você recebe a comunicação assim que houver uma decisão." },
    { q: "Posso comprar pelo site no varejo enquanto aguardo?", a: "Sim. O programa de atacado é complementar e não interfere nas compras no varejo." },
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

function CtaBlock({ onCta }: { onCta: () => void }) {
  return (
    <section className="border-t border-zinc-200 bg-zinc-900 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-12 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <h2 className="text-2xl font-semibold md:text-3xl">Pronto para começar?</h2>
          <p className="mt-2 text-zinc-300">Envie sua solicitação e nossa equipe entrará em contato.</p>
        </div>
        <Button size="lg" onClick={onCta} className="bg-white text-zinc-900 hover:bg-zinc-100">
          Solicitar Cadastro
        </Button>
      </div>
    </section>
  );
}

// ---------------- Dialog ----------------
function ApplicationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ctx, loading } = useAuth();
  const authed = !!ctx?.authenticated;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
      <div
        className="absolute inset-0"
        aria-hidden
        onClick={onClose}
      />
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
        É necessário estar conectado à sua conta para enviar a solicitação de atacado.
      </p>
      <div className="mt-6 flex gap-3">
        <Button
          onClick={() => {
            onClose();
            setTimeout(() => openAccountSheet(), 50);
          }}
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

  const getActive = useServerFn(getActiveWholesaleApplication);
  const activeQuery = useQuery({
    queryKey: ["wholesale", "active", customerId],
    queryFn: () => getActive({ data: { customer_id: customerId! } }),
    enabled: !!customerId,
  });

  if (loadingAccount || activeQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  if (activeQuery.isError) {
    return <p className="py-6 text-sm text-red-600">Erro ao carregar dados. Tente novamente.</p>;
  }

  const res = activeQuery.data;
  const active = res?.ok ? res.data : null;

  if (active) return <ExistingApplication status={active.status as Status} onClose={onClose} />;

  return <ApplicationForm customerId={customerId!} defaultName={account?.customer.name ?? ""} onClose={onClose} />;
}

function ExistingApplication({ status, onClose }: { status: Status; onClose: () => void }) {
  return (
    <div className="py-2">
      <h3 className="text-xl font-semibold text-zinc-900">Solicitação em andamento</h3>
      <p className="mt-2 text-sm text-zinc-600">
        Você já possui uma solicitação de atacado registrada. Não é possível abrir uma nova enquanto esta não for finalizada.
      </p>
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
        <span className="text-zinc-500">Status atual:</span>{" "}
        <span className="font-medium text-zinc-900">{STATUS_LABEL[status]}</span>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}

function ApplicationForm({
  customerId, defaultName, onClose,
}: { customerId: string; defaultName: string; onClose: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createWholesaleApplication);

  const [personType, setPersonType] = useState<PersonType>("pf");
  // PF
  const [name, setName] = useState(defaultName);
  const [cpf, setCpf] = useState("");
  // PJ
  const [razao, setRazao] = useState("");
  const [fantasia, setFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [ie, setIe] = useState("");
  const [responsavel, setResponsavel] = useState(defaultName);
  // comuns
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
      const metadata =
        personType === "pf"
          ? {
              person_type: "pf" as const,
              name: name.trim(), cpf: cpf.trim(),
              whatsapp: whatsapp.trim(), city: cidade.trim(), state: estado.trim().toUpperCase(),
              instagram: instagram.trim() || null, website: site.trim() || null,
              message: mensagem.trim() || null,
            }
          : {
              person_type: "pj" as const,
              legal_name: razao.trim(), trade_name: fantasia.trim() || null,
              cnpj: cnpj.trim(), state_registration: ie.trim() || null,
              contact_name: responsavel.trim(),
              whatsapp: whatsapp.trim(), city: cidade.trim(), state: estado.trim().toUpperCase(),
              instagram: instagram.trim() || null, website: site.trim() || null,
              message: mensagem.trim() || null,
            };
      const res = await createFn({
        data: { customer_id: customerId, submit: true, metadata: metadata as Record<string, never> },
      });
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      setSent(true);
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
        <h3 className="text-xl font-semibold text-zinc-900">Solicitar Cadastro Atacado</h3>
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

import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  User as UserIcon, Package, MapPin, IdCard, Heart, LogOut, Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  ACCOUNT_SHEET_EVENT,
  useStorefrontCustomer,
} from "@/hooks/use-storefront-customer";
import { useIsMobile } from "@/hooks/use-mobile";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AccountSheet() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const { ctx, signOut, loading } = useAuth();
  const authenticated = !!ctx?.authenticated;
  const account = useStorefrontCustomer();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(ACCOUNT_SHEET_EVENT, handler);
    return () => window.removeEventListener(ACCOUNT_SHEET_EVENT, handler);
  }, []);

  const close = () => setOpen(false);
  const go = (to: string) => {
    close();
    navigate({ to });
  };

  const body = loading ? (
    <div className="flex items-center justify-center py-16 text-zinc-500">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  ) : authenticated ? (
    <AuthenticatedMenu
      name={account.data?.customer.name ?? ctx?.profile?.full_name ?? "Cliente"}
      email={account.data?.customer.email ?? ""}
      onNavigate={go}
      onSignOut={async () => {
        await signOut();
        close();
        toast.success("Sessão encerrada");
      }}
    />
  ) : (
    <AuthForms onSuccess={close} />
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{authenticated ? "Minha conta" : "Entrar"}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{authenticated ? "Minha conta" : "Entrar"}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function AuthenticatedMenu({
  name, email, onNavigate, onSignOut,
}: {
  name: string;
  email: string;
  onNavigate: (to: string) => void;
  onSignOut: () => void;
}) {
  const items = [
    { icon: UserIcon, label: "Resumo", to: "/minha-conta" },
    { icon: Package, label: "Meus pedidos", to: "/minha-conta/pedidos" },
    { icon: MapPin, label: "Endereços", to: "/minha-conta/enderecos" },
    { icon: IdCard, label: "Dados pessoais", to: "/minha-conta/dados" },
    { icon: Heart, label: "Favoritos", to: "/minha-conta/favoritos" },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-zinc-50 p-4">
        <p className="text-sm font-medium text-zinc-900">{name}</p>
        <p className="text-xs text-zinc-500">{email}</p>
      </div>
      <nav className="flex flex-col">
        {items.map((it) => (
          <button
            key={it.to}
            onClick={() => onNavigate(it.to)}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            <it.icon className="h-4 w-4 text-zinc-500" />
            {it.label}
          </button>
        ))}
        <Separator className="my-2" />
        <button
          onClick={onSignOut}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-100"
        >
          <LogOut className="h-4 w-4 text-zinc-500" />
          Sair
        </button>
      </nav>
    </div>
  );
}

function AuthForms({ onSuccess }: { onSuccess: () => void }) {
  return (
    <Tabs defaultValue="signin" className="w-full">
      <TabsList className="grid grid-cols-3 w-full">
        <TabsTrigger value="signin">Entrar</TabsTrigger>
        <TabsTrigger value="signup">Cadastrar</TabsTrigger>
        <TabsTrigger value="recover">Recuperar</TabsTrigger>
      </TabsList>
      <TabsContent value="signin">
        <SignInForm onSuccess={onSuccess} />
      </TabsContent>
      <TabsContent value="signup">
        <SignUpForm onSuccess={onSuccess} />
      </TabsContent>
      <TabsContent value="recover">
        <RecoverForm />
      </TabsContent>
    </Tabs>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    onSuccess();
  };
  return (
    <form onSubmit={submit} className="space-y-3 pt-2">
      <div>
        <Label htmlFor="si-email">E-mail</Label>
        <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="si-pwd">Senha</Label>
        <Input id="si-pwd" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
      </Button>
    </form>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro realizado. Verifique seu e-mail se a confirmação estiver ativada.");
    onSuccess();
  };
  return (
    <form onSubmit={submit} className="space-y-3 pt-2">
      <div>
        <Label htmlFor="su-name">Nome completo</Label>
        <Input id="su-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="su-email">E-mail</Label>
        <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="su-pwd">Senha</Label>
        <Input id="su-pwd" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
      </Button>
    </form>
  );
}

function RecoverForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("E-mail de recuperação enviado.");
  };
  return (
    <form onSubmit={submit} className="space-y-3 pt-2">
      <div>
        <Label htmlFor="rc-email">E-mail</Label>
        <Input id="rc-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar link"}
      </Button>
    </form>
  );
}

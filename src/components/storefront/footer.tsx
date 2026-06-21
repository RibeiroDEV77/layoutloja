import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

export function StoreFooter() {
  return (
    <footer className="mt-32 border-t border-border bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:grid-cols-4">
        <div>
          <div className="font-display text-lg font-semibold">Layout</div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Moda atemporal com curadoria minimalista. Peças que duram além das estações.
          </p>
        </div>
        <FooterCol title="Comprar" items={[
          { label: 'Masculino', to: '/c/$category', params: { category: 'masculino' } },
          { label: 'Feminino', to: '/c/$category', params: { category: 'feminino' } },
          { label: 'Infantil', to: '/c/$category', params: { category: 'infantil' } },
          { label: 'Calçados', to: '/c/$category', params: { category: 'calcados' } },
          { label: 'Promoções', to: '/c/$category', params: { category: 'promocoes' } },
        ]} />
        <FooterCol title="Institucional" items={[
          { label: 'Sobre nós', to: '/sobre' },
          { label: 'Trocas e devoluções', to: '/sobre' },
          { label: 'Política de privacidade', to: '/sobre' },
          { label: 'Termos de uso', to: '/sobre' },
        ]} />
        <NewsletterCol />
      </div>
      <div className="border-t border-border px-4 py-6 text-center text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} Layout — Todos os direitos reservados.
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: Array<{ label: string; to: string; params?: Record<string, string> }> }) {
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-widest-tight">{title}</h4>
      <ul className="mt-4 space-y-2">
        {items.map((i) => (
          <li key={i.label}>
            <Link to={i.to as never} params={i.params as never} className="text-xs text-muted-foreground hover:text-foreground">{i.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewsletterCol() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes('@')) {
      toast.error('Informe um e-mail válido');
      return;
    }
    setBusy(true);
    // Persistência via subscription engine vai entrar em V2.
    setTimeout(() => {
      toast.success('Inscrito! Em breve novidades no seu e-mail.');
      setEmail(''); setBusy(false);
    }, 400);
  }
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-widest-tight">Newsletter</h4>
      <p className="mt-4 text-xs text-muted-foreground">Receba lançamentos e promoções antes de todo mundo.</p>
      <form onSubmit={submit} className="mt-4 flex border border-border bg-background">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="flex-1 bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" disabled={busy} className="bg-foreground px-3 text-[10px] font-medium uppercase tracking-widest-tight text-background hover:opacity-90 disabled:opacity-50">
          Assinar
        </button>
      </form>
    </div>
  );
}

import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_store/sobre')({
  head: () => ({
    meta: [
      { title: 'Sobre · Layout' },
      { name: 'description', content: 'Plataforma de gestão multi-tenant para varejo e atacado de moda — catálogo, estoque, vendas, expedição e fiscal.' },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 text-center">
      <span className="text-[11px] font-medium uppercase tracking-widest-tight text-accent">Sobre a Layout</span>
      <h1 className="mt-4 font-display text-4xl font-semibold md:text-5xl">Moda atemporal, gestão de classe mundial.</h1>
      <p className="mt-6 text-base leading-relaxed text-muted-foreground">
        A Layout combina curadoria de moda com uma plataforma proprietária multi-tenant que cobre catálogo,
        estoque, vendas, expedição e fiscal — para que cada peça chegue até você com excelência operacional.
      </p>
      <div className="mt-10 flex justify-center gap-3">
        <Button asChild size="lg" variant="default" className="rounded-none">
          <Link to="/">Voltar para a loja</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="rounded-none">
          <Link to="/auth">Acessar painel</Link>
        </Button>
      </div>
    </section>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Layout — ERP de Moda" },
      { name: "description", content: "Plataforma multi-tenant para varejo e atacado de moda." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-background to-muted">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Layout</h1>
        <p className="text-lg text-muted-foreground">
          Plataforma de gestão multi-tenant — catálogo, estoque, vendas, expedição e fiscal em um só lugar.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild size="lg"><Link to="/auth">Acessar painel</Link></Button>
        </div>
      </div>
    </main>
  );
}

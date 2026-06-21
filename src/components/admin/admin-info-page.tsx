/**
 * AdminInfoPage — placeholder honesto para módulos não-implementados.
 * NÃO finge funcionalidade. Lista o que falta e onde ir agora.
 */
import { type ReactNode } from "react";
import { CrudPage } from "./crud-page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// nota: usamos <a href> para evitar tipagem estrita de rotas do TanStack neste utilitário genérico
import { AlertTriangle, ArrowRight } from "lucide-react";
import { type Crumb } from "./breadcrumb-context";

export type AdminInfoPageProps = {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  status: "needs-modeling" | "deferred" | "use-other";
  statusLabel: string;
  blockers: string[];
  alternatives?: { label: string; to: string }[];
  children?: ReactNode;
};

const statusTone: Record<AdminInfoPageProps["status"], string> = {
  "needs-modeling": "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
  deferred: "text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900",
  "use-other": "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900",
};

export function AdminInfoPage(props: AdminInfoPageProps) {
  return (
    <CrudPage title={props.title} description={props.description} breadcrumbs={props.breadcrumbs}>
      <Card>
        <CardHeader>
          <div className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border text-xs font-medium w-fit ${statusTone[props.status]}`}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {props.statusLabel}
          </div>
          <CardTitle className="mt-2">O que falta para este módulo ficar pronto</CardTitle>
          <CardDescription>
            Esta tela existe para evitar 404 no menu, mas a operação real ainda não foi liberada — abaixo está exatamente o que falta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-2 text-sm">
            {props.blockers.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground mt-0.5">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {props.alternatives && props.alternatives.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Enquanto isso, use:</div>
              <div className="flex flex-wrap gap-2">
                {props.alternatives.map((a) => (
                  <Button key={a.to} asChild variant="outline" size="sm">
                    <Link to={a.to}>
                      {a.label} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          )}
          {props.children}
        </CardContent>
      </Card>
    </CrudPage>
  );
}

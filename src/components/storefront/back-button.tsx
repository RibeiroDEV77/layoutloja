import { useEffect } from "react";
import { useRouter, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type BackButtonProps = {
  /** Rota fallback quando não há histórico (ex.: "/"). */
  fallbackTo?: string;
  /** Habilita atalho Esc (default true). */
  enableEscape?: boolean;
  className?: string;
  label?: string;
};

/**
 * Botão "Voltar" reutilizável.
 * - Usa histórico do navegador via router.history.back()
 * - Fallback para rota pai quando não há histórico
 * - Atalho Esc (ignora quando foco em campos editáveis)
 * - Mobile: apenas ícone (área de toque 48x48). Desktop: ícone + texto.
 */
export function BackButton({
  fallbackTo = "/",
  enableEscape = true,
  className,
  label = "Voltar",
}: BackButtonProps) {
  const router = useRouter();
  const navigate = useNavigate();

  const goBack = () => {
    const hasHistory =
      typeof window !== "undefined" && window.history.length > 1;
    if (hasHistory) {
      router.history.back();
    } else {
      navigate({ to: fallbackTo });
    }
  };

  useEffect(() => {
    if (!enableEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable
      ) {
        return;
      }
      goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableEscape]);

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Voltar para página anterior"
      className={cn(
        "group inline-flex items-center gap-2 rounded-lg border border-transparent",
        "text-zinc-700 hover:bg-zinc-100",
        "transition-all duration-150 ease-out",
        "hover:-translate-x-0.5 hover:scale-105 active:scale-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300",
        // Mobile: toque 48x48, só ícone
        "h-12 w-12 justify-center md:h-9 md:w-auto md:px-3",
        className,
      )}
    >
      <ArrowLeft className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      <span className="hidden md:inline text-[14px] font-medium">{label}</span>
    </button>
  );
}

import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/** Global top progress bar — reflects router pending state across all navigation. */
export function RouterProgress() {
  const isLoading = useRouterState({ select: (s) => s.isLoading || s.isTransitioning });
  return (
    <div
      aria-hidden
      className={cn(
        "fixed top-0 left-0 right-0 h-0.5 z-[60] transition-opacity duration-200 pointer-events-none",
        isLoading ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="h-full bg-primary animate-pulse" />
    </div>
  );
}

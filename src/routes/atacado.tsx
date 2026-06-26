/**
 * /atacado — layout do Portal/Canal Atacado (Sprint 10).
 * Apenas renderiza <Outlet /> para que /atacado (index) e /atacado/home
 * possam coexistir.
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/atacado")({
  component: () => <Outlet />,
});

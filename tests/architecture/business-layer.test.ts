/**
 * Architectural invariants — Business Layer boundary.
 *
 * These tests fail the build if structural rules from ADR-0003 are broken.
 * They are not perf tests; they protect the architecture from accidental drift.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd());

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(p, acc);
    } else acc.push(p);
  }
  return acc;
}

function readSafe(p: string): string {
  try { return readFileSync(p, "utf8"); } catch { return ""; }
}

const ROUTE_FILES = walk(join(ROOT, "src/routes")).filter((p) =>
  p.endsWith(".tsx") || p.endsWith(".ts"),
);
const FUNCTION_FILES = walk(join(ROOT, "src/lib/business")).filter((p) =>
  p.endsWith(".functions.ts") || p.endsWith(".functions.tsx"),
);
const SERVICE_FILES = walk(join(ROOT, "src/lib/business")).filter((p) =>
  p.endsWith(".server.ts") || p.endsWith(".server.tsx"),
);

// Domain tables that UI must never touch directly (use Server Functions).
// Plataforma/infra (auth, profiles) e dados de sessão são permitidos no client.
const FORBIDDEN_DOMAIN_TABLES = [
  "orders", "order_items", "order_payments", "order_ledger", "order_timeline",
  "order_holds", "order_fulfillments", "order_shipments", "order_returns",
  "carts", "cart_items", "cart_coupons", "cart_timeline",
  "stock_reservations", "stock_movements", "stock_levels",
  "coupons", "coupon_ledger",
  "shipping_quotes", "shipping_rates",
  "products", "product_variants", "product_colors",
  "customers", "customer_addresses", "customer_credit_ledger",
  "purchase_orders", "goods_receipts", "inventory_counts",
  "event_outbox", "idempotency_keys", "audit_log",
];

describe("Architecture: Business Layer boundary (ADR-0003)", () => {
  it("route files do not query domain tables directly via supabase.from()", () => {
    const violations: string[] = [];
    for (const file of ROUTE_FILES) {
      const src = readSafe(file);
      for (const table of FORBIDDEN_DOMAIN_TABLES) {
        const re = new RegExp(`\\.from\\(\\s*["']${table}["']`);
        if (re.test(src)) {
          violations.push(`${relative(ROOT, file)} → .from("${table}")`);
        }
      }
    }
    expect(violations, `\nUI must consume Server Functions, never query domain tables.\n${violations.join("\n")}`).toEqual([]);
  });

  it("route files do not import from *.server.ts modules", () => {
    const violations: string[] = [];
    for (const file of ROUTE_FILES) {
      const src = readSafe(file);
      if (/from\s+["'][^"']*\.server["']/.test(src)) {
        violations.push(relative(ROOT, file));
      }
    }
    expect(violations, `\nRoute files must not import .server.ts modules.\n${violations.join("\n")}`).toEqual([]);
  });
});

describe("Architecture: Server Functions (ADR-0003 / ADR-0006)", () => {
  it("*.functions.ts never imports client.server at module scope", () => {
    const violations: string[] = [];
    for (const file of FUNCTION_FILES) {
      const src = readSafe(file);
      // Module-scope import = top-level `import ... from "@/integrations/supabase/client.server"`
      const moduleScopeImport = /^\s*import[^;]*from\s+["']@\/integrations\/supabase\/client\.server["']/m;
      if (moduleScopeImport.test(src)) {
        violations.push(relative(ROOT, file));
      }
    }
    expect(violations, `\n*.functions.ts must load client.server inside handlers via await import().\n${violations.join("\n")}`).toEqual([]);
  });
});

describe("Architecture: services live under src/lib/business (ADR-0003)", () => {
  it("no *.server.ts under src/routes", () => {
    const offenders = ROUTE_FILES.filter((p) => /\.server\.tsx?$/.test(p));
    expect(offenders.map((p) => relative(ROOT, p))).toEqual([]);
  });

  it("services exist for the approved business domain", () => {
    const expected = ["cart.server.ts", "pricing.server.ts", "stock-reservation.server.ts", "coupons.server.ts", "shipping.server.ts"];
    const present = new Set(SERVICE_FILES.map((p) => p.split("/").pop()!));
    const missing = expected.filter((e) => !present.has(e));
    expect(missing, `\nExpected core services missing in src/lib/business/services/.\n${missing.join("\n")}`).toEqual([]);
  });
});

describe("Architecture: secrets are server-side only (ADR-0007/0009)", () => {
  it("SUPABASE_SERVICE_ROLE_KEY is never referenced from src/routes or src/components", () => {
    const clientDirs = [join(ROOT, "src/routes"), join(ROOT, "src/components"), join(ROOT, "src/hooks")];
    const violations: string[] = [];
    for (const d of clientDirs) {
      try { statSync(d); } catch { continue; }
      for (const f of walk(d)) {
        if (!/\.tsx?$/.test(f)) continue;
        const src = readSafe(f);
        if (/SUPABASE_SERVICE_ROLE_KEY/.test(src)) {
          violations.push(relative(ROOT, f));
        }
      }
    }
    expect(violations, `\nService role key must never appear in client-side code.\n${violations.join("\n")}`).toEqual([]);
  });
});

/**
 * Architectural invariants — Database migrations.
 *
 * Enforces ADR-0009 (RLS) and the public-schema GRANT rule.
 * Scans supabase/migrations/*.sql and fails the build when a CREATE TABLE
 * in the public schema lacks the required GRANT + ENABLE RLS in the same file.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase/migrations");

const migrationFiles = existsSync(MIGRATIONS_DIR)
  ? readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"))
  : [];

function tablesCreatedIn(sql: string): string[] {
  const re = /create\s+table(?:\s+if\s+not\s+exists)?\s+(?:public\.)?([a-z0-9_]+)/gi;
  const out: string[] = [];
  let m;
  while ((m = re.exec(sql)) !== null) {
    // Only public-schema creations (default schema = public here).
    if (!/create\s+table[^;]*\.(?!public\.)/i.test(m[0]) || /public\./i.test(m[0])) {
      out.push(m[1].toLowerCase());
    }
  }
  return out;
}

describe("Architecture: migrations follow ADR-0009 (RLS + GRANT)", () => {
  it("every public-schema CREATE TABLE has GRANT in the same migration", () => {
    const violations: string[] = [];
    for (const file of migrationFiles) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const tables = tablesCreatedIn(sql);
      for (const t of tables) {
        const grantRe = new RegExp(`grant\\s+[^;]+on\\s+(?:table\\s+)?(?:public\\.)?${t}\\b`, "i");
        if (!grantRe.test(sql)) {
          violations.push(`${file} → table "${t}" is missing GRANT`);
        }
      }
    }
    expect(violations, `\nMissing GRANT statements (ADR-0009).\n${violations.join("\n")}`).toEqual([]);
  });

  it("every public-schema CREATE TABLE enables RLS in the same migration", () => {
    const violations: string[] = [];
    for (const file of migrationFiles) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const tables = tablesCreatedIn(sql);
      for (const t of tables) {
        const rlsRe = new RegExp(`alter\\s+table\\s+(?:public\\.)?${t}\\s+enable\\s+row\\s+level\\s+security`, "i");
        if (!rlsRe.test(sql)) {
          violations.push(`${file} → table "${t}" is missing ENABLE ROW LEVEL SECURITY`);
        }
      }
    }
    expect(violations, `\nMissing ENABLE RLS (ADR-0009).\n${violations.join("\n")}`).toEqual([]);
  });

  it("security definer functions declare a fixed search_path", () => {
    const violations: string[] = [];
    for (const file of migrationFiles) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      // Find function bodies marked SECURITY DEFINER and require SET search_path within ~600 chars window.
      const re = /create\s+(?:or\s+replace\s+)?function\s+[^;]*?security\s+definer[^;]*?(?:set\s+search_path\s*=\s*[\w,\s]+|language\s+\w+\s+as\s+\$\$)/gis;
      const fnRe = /create\s+(?:or\s+replace\s+)?function\s+(public\.[a-z0-9_]+)[\s\S]*?security\s+definer/gi;
      let m;
      while ((m = fnRe.exec(sql)) !== null) {
        const start = m.index;
        const window = sql.slice(start, start + 1200);
        if (!/set\s+search_path\s*=/i.test(window)) {
          violations.push(`${file} → function ${m[1]} missing SET search_path`);
        }
      }
    }
    expect(violations, `\nSECURITY DEFINER functions must SET search_path (ADR-0008).\n${violations.join("\n")}`).toEqual([]);
  });
});

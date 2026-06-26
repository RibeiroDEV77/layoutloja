import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- helpers ----------
const pii = () => process.env.CUSTOMER_PII_KEY ?? null;

async function ensureCustomer(ctx: any) {
  const { supabase, userId } = ctx;
  const { data: existing } = await supabase
    .from("customers")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();
  if (existing) return existing;

  // Fallback: trigger não rodou (ex.: criado antes da migration)
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!store) throw new Error("Nenhuma loja configurada");

  const { data: user } = await supabase.auth.getUser();
  const email = user.user?.email ?? null;
  const name =
    (user.user?.user_metadata as any)?.full_name ||
    (user.user?.user_metadata as any)?.name ||
    (email ? email.split("@")[0] : "Cliente");

  const { data: created, error } = await supabase
    .from("customers")
    .insert({
      store_id: store.id,
      type: "pf",
      status: "active",
      email,
      name,
      auth_user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return created;
}

// ---------- queries ----------
export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const customer = await ensureCustomer(context);

    // Descriptografa CPF, se houver
    let doc_number: string | null = customer.doc_number ?? null;
    const key = pii();
    if (customer.doc_number_encrypted && key) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin.rpc("decrypt_pii", {
        p_value: customer.doc_number_encrypted,
        p_key: key,
      });
      if (data) doc_number = data as string;
    }

    const { data: addresses } = await context.supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        birth_date: customer.birth_date,
        doc_number,
        marketing_opt_in: customer.marketing_opt_in,
      },
      addresses: addresses ?? [],
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(2).max(120),
        phone: z.string().max(40).optional().nullable(),
        birth_date: z.string().optional().nullable(),
        doc_number: z.string().max(20).optional().nullable(),
        marketing_opt_in: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const customer = await ensureCustomer(context);
    const update: Record<string, any> = {
      name: data.name,
      phone: data.phone ?? null,
      birth_date: data.birth_date || null,
      marketing_opt_in: data.marketing_opt_in ?? customer.marketing_opt_in,
    };

    if (data.doc_number !== undefined) {
      update.doc_number = data.doc_number || null;
      const key2 = pii();
      if (data.doc_number && key2) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: enc } = await supabaseAdmin.rpc("encrypt_pii", {
          p_value: data.doc_number,
          p_key: key2,
        });
        update.doc_number_encrypted = enc ?? null;
      } else if (!data.doc_number) {
        update.doc_number_encrypted = null;
      }
    }

    const { error } = await (context.supabase as any)
      .from("customers")
      .update(update)
      .eq("id", customer.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- addresses ----------
const addressSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().max(60).optional().nullable(),
  type: z.enum(["residencial", "comercial", "outro"]).default("residencial"),
  recipient: z.string().max(120).optional().nullable(),
  zipcode: z.string().max(15).optional().nullable(),
  street: z.string().max(200).optional().nullable(),
  number: z.string().max(20).optional().nullable(),
  complement: z.string().max(120).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  country: z.string().max(2).default("BR"),
  phone: z.string().max(40).optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
  is_default_shipping: z.boolean().optional(),
  is_default_billing: z.boolean().optional(),
});

export const upsertMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addressSchema.parse(d))
  .handler(async ({ context, data }) => {
    const customer = await ensureCustomer(context);
    const payload: any = { ...data, customer_id: customer.id };

    if (data.is_default_shipping) {
      await context.supabase
        .from("customer_addresses")
        .update({ is_default_shipping: false })
        .eq("customer_id", customer.id);
    }
    if (data.is_default_billing) {
      await context.supabase
        .from("customer_addresses")
        .update({ is_default_billing: false })
        .eq("customer_id", customer.id);
    }

    if (data.id) {
      const { error } = await context.supabase
        .from("customer_addresses")
        .update(payload)
        .eq("id", data.id)
        .eq("customer_id", customer.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("customer_addresses")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { id: created.id };
  });

export const deleteMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const customer = await ensureCustomer(context);
    const { error } = await context.supabase
      .from("customer_addresses")
      .delete()
      .eq("id", data.id)
      .eq("customer_id", customer.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- orders ----------
export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const customer = await ensureCustomer(context);
    const { data, error } = await context.supabase
      .from("orders")
      .select("id, code, status, total_amount, currency, created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  });

export const getMyOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const customer = await ensureCustomer(context);
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", data.id)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (error) throw error;
    return order;
  });

// ---------- wishlist ----------
async function ensureWishlist(ctx: any, customerId: string, storeId: string) {
  const { data } = await ctx.supabase
    .from("wishlists")
    .select("id")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (data) return data.id as string;
  const { data: created, error } = await ctx.supabase
    .from("wishlists")
    .insert({ customer_id: customerId, store_id: storeId, name: "Favoritos" })
    .select("id")
    .single();
  if (error) throw error;
  return created.id as string;
}

export const listMyWishlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const customer = await ensureCustomer(context);
    const wid = await ensureWishlist(context, customer.id, customer.store_id);
    const { data, error } = await context.supabase
      .from("wishlist_items")
      .select("id, product_id, variant_id, added_at, products(id, name, slug)")
      .eq("wishlist_id", wid)
      .order("added_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const addToWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ product_id: z.string().uuid(), variant_id: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const customer = await ensureCustomer(context);
    const wid = await ensureWishlist(context, customer.id, customer.store_id);
    const { error } = await context.supabase
      .from("wishlist_items")
      .insert({
        wishlist_id: wid,
        store_id: customer.store_id,
        product_id: data.product_id,
        variant_id: data.variant_id ?? null,
      });
    if (error && !String(error.message).includes("duplicate")) throw error;
    return { ok: true };
  });

export const removeFromWishlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const customer = await ensureCustomer(context);
    const wid = await ensureWishlist(context, customer.id, customer.store_id);
    const { error } = await context.supabase
      .from("wishlist_items")
      .delete()
      .eq("id", data.id)
      .eq("wishlist_id", wid);
    if (error) throw error;
    return { ok: true };
  });

// ---------- shipping quote (Melhor Envio, sem autenticação) ----------
export const quoteShippingForAddress = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        destination_postal_code: z.string().min(8).max(9),
        weight_g: z.number().int().positive().max(30000).default(500),
        declared_value: z.number().nonnegative().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { calculateQuotes } = await import(
        "@/lib/business/services/shipping/melhor-envio-direct.server"
      );
      const quotes = await calculateQuotes({
        destination_postal_code: data.destination_postal_code,
        weight_g: data.weight_g,
        declared_value: data.declared_value,
      });
      return {
        quotes: quotes.map(({ raw: _r, ...q }) => q).sort((a, b) => a.price - b.price),
        error: null as string | null,
      };
    } catch (e) {
      return { quotes: [], error: (e as Error).message };
    }
  });

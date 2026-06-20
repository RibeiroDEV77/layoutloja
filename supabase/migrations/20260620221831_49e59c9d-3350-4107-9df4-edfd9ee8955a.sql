
-- =========================================================================
-- FASE 2 — CATÁLOGO
-- Padrão oficial: Produto → Cor → Galeria da Cor → Tamanho → SKU → Preço → Estoque
-- =========================================================================

-- ENUMs
create type public.product_status as enum ('draft','published','archived');
create type public.product_visibility as enum ('published','hidden','private','catalog_only');
create type public.sale_channel as enum ('varejo','atacado','ambos');
create type public.attribute_input_type as enum ('select','text','number','boolean');
create type public.media_type as enum ('image','video','youtube','vimeo');
create type public.collection_type as enum ('manual','smart');
create type public.customer_group_kind as enum ('varejo','atacado','vip','representante','distribuidor','revendedor');

-- =========================================================================
-- A. TAXONOMIA & ATRIBUTOS
-- =========================================================================

-- 1. categories (hierárquica)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete set null,
  slug text not null,
  name text not null,
  description text,
  path text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  image_url text,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);
create index idx_categories_store on public.categories(store_id);
create index idx_categories_parent on public.categories(parent_id);
grant select, insert, update, delete on public.categories to authenticated;
grant select on public.categories to anon;
grant all on public.categories to service_role;
alter table public.categories enable row level security;

-- 2. brands
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  logo_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);
create index idx_brands_store on public.brands(store_id);
grant select, insert, update, delete on public.brands to authenticated;
grant select on public.brands to anon;
grant all on public.brands to service_role;
alter table public.brands enable row level security;

-- 3. collections
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  type public.collection_type not null default 'manual',
  rules_json jsonb,
  image_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);
create index idx_collections_store on public.collections(store_id);
grant select, insert, update, delete on public.collections to authenticated;
grant select on public.collections to anon;
grant all on public.collections to service_role;
alter table public.collections enable row level security;

-- 4. tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  slug text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (store_id, slug)
);
create index idx_tags_store on public.tags(store_id);
grant select, insert, update, delete on public.tags to authenticated;
grant select on public.tags to anon;
grant all on public.tags to service_role;
alter table public.tags enable row level security;

-- 5. attributes
create table public.attributes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  name text not null,
  input_type public.attribute_input_type not null default 'select',
  unit text,
  is_color boolean not null default false,
  is_size boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code)
);
create index idx_attributes_store on public.attributes(store_id);
grant select, insert, update, delete on public.attributes to authenticated;
grant select on public.attributes to anon;
grant all on public.attributes to service_role;
alter table public.attributes enable row level security;

-- 6. attribute_values
create table public.attribute_values (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references public.attributes(id) on delete cascade,
  code text not null,
  label text not null,
  sort_order int not null default 0,
  meta_json jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (attribute_id, code)
);
create index idx_attribute_values_attribute on public.attribute_values(attribute_id);
grant select, insert, update, delete on public.attribute_values to authenticated;
grant select on public.attribute_values to anon;
grant all on public.attribute_values to service_role;
alter table public.attribute_values enable row level security;

-- 7. category_attributes
create table public.category_attributes (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  attribute_id uuid not null references public.attributes(id) on delete cascade,
  is_required boolean not null default false,
  is_variant_axis boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, attribute_id)
);
create index idx_category_attributes_category on public.category_attributes(category_id);
create index idx_category_attributes_attribute on public.category_attributes(attribute_id);
grant select, insert, update, delete on public.category_attributes to authenticated;
grant select on public.category_attributes to anon;
grant all on public.category_attributes to service_role;
alter table public.category_attributes enable row level security;

-- =========================================================================
-- B. PRODUTO
-- =========================================================================

-- 8. products
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  sku_root text not null,
  slug text not null,
  name text not null,
  short_description text,
  description text,
  status public.product_status not null default 'draft',
  visibility public.product_visibility not null default 'hidden',
  sale_channel public.sale_channel not null default 'varejo',
  tax_class text,
  -- indicadores de vitrine
  featured boolean not null default false,
  new_product boolean not null default false,
  best_seller boolean not null default false,
  on_sale boolean not null default false,
  -- seo
  seo_title text,
  seo_description text,
  -- pesos/timestamps
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug),
  unique (store_id, sku_root)
);
create index idx_products_store on public.products(store_id);
create index idx_products_category on public.products(category_id);
create index idx_products_brand on public.products(brand_id);
create index idx_products_status_visibility on public.products(status, visibility);
create index idx_products_featured on public.products(store_id) where featured = true;
create index idx_products_new on public.products(store_id) where new_product = true;
create index idx_products_bestseller on public.products(store_id) where best_seller = true;
create index idx_products_onsale on public.products(store_id) where on_sale = true;
grant select, insert, update, delete on public.products to authenticated;
grant select on public.products to anon;
grant all on public.products to service_role;
alter table public.products enable row level security;

-- 9. product_tags
create table public.product_tags (
  product_id uuid not null references public.products(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (product_id, tag_id)
);
grant select, insert, update, delete on public.product_tags to authenticated;
grant select on public.product_tags to anon;
grant all on public.product_tags to service_role;
alter table public.product_tags enable row level security;

-- 10. product_collections
create table public.product_collections (
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  sort_order int not null default 0,
  primary key (product_id, collection_id)
);
grant select, insert, update, delete on public.product_collections to authenticated;
grant select on public.product_collections to anon;
grant all on public.product_collections to service_role;
alter table public.product_collections enable row level security;

-- 11. product_attribute_values (atributos descritivos, não eixos de variação)
create table public.product_attribute_values (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_id uuid not null references public.attributes(id) on delete restrict,
  attribute_value_id uuid references public.attribute_values(id) on delete restrict,
  value_text text,
  value_number numeric,
  value_boolean boolean,
  created_at timestamptz not null default now(),
  unique (product_id, attribute_id, attribute_value_id)
);
create index idx_pav_product on public.product_attribute_values(product_id);
grant select, insert, update, delete on public.product_attribute_values to authenticated;
grant select on public.product_attribute_values to anon;
grant all on public.product_attribute_values to service_role;
alter table public.product_attribute_values enable row level security;

-- =========================================================================
-- C. COR + MÍDIA DA COR
-- =========================================================================

-- 12. product_colors
create table public.product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_value_id uuid references public.attribute_values(id) on delete restrict,
  name text not null,
  hex text,
  sort_order int not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, name)
);
create index idx_product_colors_product on public.product_colors(product_id);
grant select, insert, update, delete on public.product_colors to authenticated;
grant select on public.product_colors to anon;
grant all on public.product_colors to service_role;
alter table public.product_colors enable row level security;

-- 13. product_color_media
create table public.product_color_media (
  id uuid primary key default gen_random_uuid(),
  product_color_id uuid not null references public.product_colors(id) on delete cascade,
  media_type public.media_type not null,
  storage_path text,        -- para image/video
  external_url text,        -- url canônica (youtube/vimeo) ou cdn
  external_id text,         -- id do youtube/vimeo
  thumbnail_url text,
  alt text,
  title text,
  width int,
  height int,
  duration_seconds int,
  sort_order int not null default 0,
  is_cover boolean not null default false,
  is_hover_media boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_pcm_color on public.product_color_media(product_color_id);
grant select, insert, update, delete on public.product_color_media to authenticated;
grant select on public.product_color_media to anon;
grant all on public.product_color_media to service_role;
alter table public.product_color_media enable row level security;

-- =========================================================================
-- D. SKU / VARIANTES
-- =========================================================================

-- 14. product_variants
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  product_color_id uuid not null references public.product_colors(id) on delete cascade,
  size_attribute_value_id uuid references public.attribute_values(id) on delete restrict,
  sku text not null,
  internal_reference text,
  barcode text,
  weight_grams numeric,
  length_mm numeric,
  width_mm numeric,
  height_mm numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_color_id, size_attribute_value_id),
  unique (sku)
);
create index idx_variants_product on public.product_variants(product_id);
create index idx_variants_color on public.product_variants(product_color_id);
create index idx_variants_internal_ref on public.product_variants(internal_reference) where internal_reference is not null;
grant select, insert, update, delete on public.product_variants to authenticated;
grant select on public.product_variants to anon;
grant all on public.product_variants to service_role;
alter table public.product_variants enable row level security;

-- 15. variant_attribute_values (eixos extras além de cor/tamanho)
create table public.variant_attribute_values (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  attribute_id uuid not null references public.attributes(id) on delete restrict,
  attribute_value_id uuid not null references public.attribute_values(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (variant_id, attribute_id)
);
create index idx_vav_variant on public.variant_attribute_values(variant_id);
grant select, insert, update, delete on public.variant_attribute_values to authenticated;
grant select on public.variant_attribute_values to anon;
grant all on public.variant_attribute_values to service_role;
alter table public.variant_attribute_values enable row level security;

-- =========================================================================
-- E. PREÇOS
-- =========================================================================

-- 16. customer_groups
create table public.customer_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  name text not null,
  kind public.customer_group_kind not null,
  default_discount_pct numeric(5,2) not null default 0,
  requires_approval boolean not null default false,
  is_active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code)
);
create index idx_cgroups_store on public.customer_groups(store_id);
grant select, insert, update, delete on public.customer_groups to authenticated;
grant all on public.customer_groups to service_role;
alter table public.customer_groups enable row level security;

-- 17. price_lists
create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  code text not null,
  name text not null,
  currency text not null default 'BRL',
  priority int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, code)
);
create index idx_pricelists_store on public.price_lists(store_id);
grant select, insert, update, delete on public.price_lists to authenticated;
grant select on public.price_lists to anon;
grant all on public.price_lists to service_role;
alter table public.price_lists enable row level security;

-- 18. price_list_customer_groups (N:N)
create table public.price_list_customer_groups (
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  customer_group_id uuid not null references public.customer_groups(id) on delete cascade,
  primary key (price_list_id, customer_group_id)
);
grant select, insert, update, delete on public.price_list_customer_groups to authenticated;
grant all on public.price_list_customer_groups to service_role;
alter table public.price_list_customer_groups enable row level security;

-- 19. price_list_items
create table public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_lists(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  price numeric(14,2) not null,
  compare_at_price numeric(14,2),
  min_quantity int not null default 1,
  max_quantity int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (price_list_id, variant_id, min_quantity)
);
create index idx_pli_pricelist on public.price_list_items(price_list_id);
create index idx_pli_variant on public.price_list_items(variant_id);
grant select, insert, update, delete on public.price_list_items to authenticated;
grant select on public.price_list_items to anon;
grant all on public.price_list_items to service_role;
alter table public.price_list_items enable row level security;

-- =========================================================================
-- HELPERS DE ESCOPO (store_id derivado)
-- =========================================================================

create or replace function public.product_store_id(_product_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select store_id from public.products where id = _product_id
$$;

create or replace function public.color_store_id(_color_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.store_id from public.product_colors pc
  join public.products p on p.id = pc.product_id where pc.id = _color_id
$$;

create or replace function public.variant_store_id(_variant_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select p.store_id from public.product_variants v
  join public.products p on p.id = v.product_id where v.id = _variant_id
$$;

revoke execute on function public.product_store_id(uuid) from public, anon;
revoke execute on function public.color_store_id(uuid) from public, anon;
revoke execute on function public.variant_store_id(uuid) from public, anon;
grant execute on function public.product_store_id(uuid) to authenticated, service_role;
grant execute on function public.color_store_id(uuid) to authenticated, service_role;
grant execute on function public.variant_store_id(uuid) to authenticated, service_role;

-- =========================================================================
-- TRIGGERS DE updated_at
-- =========================================================================
create trigger trg_categories_updated before update on public.categories for each row execute function public.set_updated_at();
create trigger trg_brands_updated before update on public.brands for each row execute function public.set_updated_at();
create trigger trg_collections_updated before update on public.collections for each row execute function public.set_updated_at();
create trigger trg_attributes_updated before update on public.attributes for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger trg_product_colors_updated before update on public.product_colors for each row execute function public.set_updated_at();
create trigger trg_product_color_media_updated before update on public.product_color_media for each row execute function public.set_updated_at();
create trigger trg_product_variants_updated before update on public.product_variants for each row execute function public.set_updated_at();
create trigger trg_customer_groups_updated before update on public.customer_groups for each row execute function public.set_updated_at();
create trigger trg_price_lists_updated before update on public.price_lists for each row execute function public.set_updated_at();
create trigger trg_price_list_items_updated before update on public.price_list_items for each row execute function public.set_updated_at();

-- =========================================================================
-- TRIGGERS DE VALIDAÇÃO
-- =========================================================================

-- product_color_media: coerência entre media_type e campos
create or replace function public.validate_product_color_media()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.media_type in ('image','video') and (new.storage_path is null or length(new.storage_path) = 0) then
    raise exception 'storage_path é obrigatório para media_type=%', new.media_type;
  end if;
  if new.media_type in ('youtube','vimeo') and (new.external_id is null or length(new.external_id) = 0) then
    raise exception 'external_id é obrigatório para media_type=%', new.media_type;
  end if;
  return new;
end;
$$;
create trigger trg_validate_pcm before insert or update on public.product_color_media
for each row execute function public.validate_product_color_media();

-- product_colors: garantir um único is_default por produto
create or replace function public.enforce_single_default_color()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_default then
    update public.product_colors set is_default = false
    where product_id = new.product_id and id <> new.id and is_default = true;
  end if;
  return new;
end;
$$;
create trigger trg_single_default_color after insert or update of is_default on public.product_colors
for each row when (new.is_default = true) execute function public.enforce_single_default_color();

-- product_color_media: garantir uma única capa por cor
create or replace function public.enforce_single_cover_media()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_cover then
    update public.product_color_media set is_cover = false
    where product_color_id = new.product_color_id and id <> new.id and is_cover = true;
  end if;
  if new.is_hover_media then
    update public.product_color_media set is_hover_media = false
    where product_color_id = new.product_color_id and id <> new.id and is_hover_media = true;
  end if;
  return new;
end;
$$;
create trigger trg_single_cover_media after insert or update of is_cover, is_hover_media on public.product_color_media
for each row when (new.is_cover = true or new.is_hover_media = true) execute function public.enforce_single_cover_media();

-- =========================================================================
-- TRIGGER GENÉRICO DE AUDITORIA
-- =========================================================================
create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_store_id uuid;
  v_entity text := tg_table_name;
  v_entity_id uuid;
  v_action text := lower(tg_op);
begin
  if tg_op = 'DELETE' then
    v_entity_id := (to_jsonb(old)->>'id')::uuid;
    v_store_id := (to_jsonb(old)->>'store_id')::uuid;
  else
    v_entity_id := (to_jsonb(new)->>'id')::uuid;
    v_store_id := (to_jsonb(new)->>'store_id')::uuid;
  end if;

  insert into public.audit_log(store_id, actor_user_id, action, entity, entity_id, old_data, new_data)
  values (
    v_store_id, auth.uid(), v_action, v_entity, v_entity_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_audit_products after insert or update or delete on public.products
for each row execute function public.audit_row_change();
create trigger trg_audit_variants after insert or update or delete on public.product_variants
for each row execute function public.audit_row_change();
create trigger trg_audit_price_list_items after insert or update or delete on public.price_list_items
for each row execute function public.audit_row_change();

-- =========================================================================
-- RLS POLICIES
-- =========================================================================

-- Padrão: membros da loja leem; quem tem permissão escreve; anon lê apenas
-- conteúdo publicado quando aplicável.

-- categories
create policy categories_member_select on public.categories for select
  using (store_id in (select public.user_store_ids(auth.uid())));
create policy categories_public_select on public.categories for select to anon
  using (is_active = true);
create policy categories_write on public.categories for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', store_id))
  with check (public.has_permission(auth.uid(), 'products.update', store_id));

-- brands
create policy brands_member_select on public.brands for select
  using (store_id in (select public.user_store_ids(auth.uid())));
create policy brands_public_select on public.brands for select to anon
  using (is_active = true);
create policy brands_write on public.brands for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', store_id))
  with check (public.has_permission(auth.uid(), 'products.update', store_id));

-- collections
create policy collections_member_select on public.collections for select
  using (store_id in (select public.user_store_ids(auth.uid())));
create policy collections_public_select on public.collections for select to anon
  using (is_active = true);
create policy collections_write on public.collections for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', store_id))
  with check (public.has_permission(auth.uid(), 'products.update', store_id));

-- tags
create policy tags_member_select on public.tags for select
  using (store_id in (select public.user_store_ids(auth.uid())));
create policy tags_public_select on public.tags for select to anon using (true);
create policy tags_write on public.tags for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', store_id))
  with check (public.has_permission(auth.uid(), 'products.update', store_id));

-- attributes
create policy attributes_member_select on public.attributes for select
  using (store_id in (select public.user_store_ids(auth.uid())));
create policy attributes_public_select on public.attributes for select to anon using (true);
create policy attributes_write on public.attributes for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', store_id))
  with check (public.has_permission(auth.uid(), 'products.update', store_id));

-- attribute_values (derivado de attribute)
create policy attribute_values_select on public.attribute_values for select using (true);
create policy attribute_values_write on public.attribute_values for all to authenticated
  using (exists (
    select 1 from public.attributes a
    where a.id = attribute_id
      and public.has_permission(auth.uid(), 'products.update', a.store_id)
  ))
  with check (exists (
    select 1 from public.attributes a
    where a.id = attribute_id
      and public.has_permission(auth.uid(), 'products.update', a.store_id)
  ));

-- category_attributes (derivado de category)
create policy category_attributes_select on public.category_attributes for select using (true);
create policy category_attributes_write on public.category_attributes for all to authenticated
  using (exists (
    select 1 from public.categories c
    where c.id = category_id
      and public.has_permission(auth.uid(), 'products.update', c.store_id)
  ))
  with check (exists (
    select 1 from public.categories c
    where c.id = category_id
      and public.has_permission(auth.uid(), 'products.update', c.store_id)
  ));

-- products
create policy products_member_select on public.products for select
  using (store_id in (select public.user_store_ids(auth.uid())));
create policy products_public_select on public.products for select to anon
  using (status = 'published' and visibility in ('published','catalog_only'));
create policy products_insert on public.products for insert to authenticated
  with check (public.has_permission(auth.uid(), 'products.create', store_id));
create policy products_update on public.products for update to authenticated
  using (public.has_permission(auth.uid(), 'products.update', store_id))
  with check (public.has_permission(auth.uid(), 'products.update', store_id));
create policy products_delete on public.products for delete to authenticated
  using (public.has_permission(auth.uid(), 'products.delete', store_id));

-- product_tags / product_collections / product_attribute_values: derivam de product
create policy product_tags_select on public.product_tags for select using (true);
create policy product_tags_write on public.product_tags for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', public.product_store_id(product_id)))
  with check (public.has_permission(auth.uid(), 'products.update', public.product_store_id(product_id)));

create policy product_collections_select on public.product_collections for select using (true);
create policy product_collections_write on public.product_collections for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', public.product_store_id(product_id)))
  with check (public.has_permission(auth.uid(), 'products.update', public.product_store_id(product_id)));

create policy pav_select on public.product_attribute_values for select using (true);
create policy pav_write on public.product_attribute_values for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', public.product_store_id(product_id)))
  with check (public.has_permission(auth.uid(), 'products.update', public.product_store_id(product_id)));

-- product_colors
create policy colors_select on public.product_colors for select using (true);
create policy colors_write on public.product_colors for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', public.product_store_id(product_id)))
  with check (public.has_permission(auth.uid(), 'products.update', public.product_store_id(product_id)));

-- product_color_media
create policy pcm_select on public.product_color_media for select using (true);
create policy pcm_write on public.product_color_media for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', public.color_store_id(product_color_id)))
  with check (public.has_permission(auth.uid(), 'products.update', public.color_store_id(product_color_id)));

-- product_variants
create policy variants_select on public.product_variants for select using (true);
create policy variants_write on public.product_variants for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', public.product_store_id(product_id)))
  with check (public.has_permission(auth.uid(), 'products.update', public.product_store_id(product_id)));

-- variant_attribute_values
create policy vav_select on public.variant_attribute_values for select using (true);
create policy vav_write on public.variant_attribute_values for all to authenticated
  using (public.has_permission(auth.uid(), 'products.update', public.variant_store_id(variant_id)))
  with check (public.has_permission(auth.uid(), 'products.update', public.variant_store_id(variant_id)));

-- customer_groups (sem leitura pública)
create policy cgroups_member_select on public.customer_groups for select
  using (store_id in (select public.user_store_ids(auth.uid())));
create policy cgroups_write on public.customer_groups for all to authenticated
  using (public.has_permission(auth.uid(), 'users.manage', store_id))
  with check (public.has_permission(auth.uid(), 'users.manage', store_id));

-- price_lists
create policy pricelists_member_select on public.price_lists for select
  using (store_id in (select public.user_store_ids(auth.uid())));
create policy pricelists_public_select on public.price_lists for select to anon
  using (is_active = true);
create policy pricelists_write on public.price_lists for all to authenticated
  using (public.has_permission(auth.uid(), 'finance.manage', store_id))
  with check (public.has_permission(auth.uid(), 'finance.manage', store_id));

-- price_list_customer_groups
create policy plcg_select on public.price_list_customer_groups for select using (true);
create policy plcg_write on public.price_list_customer_groups for all to authenticated
  using (exists (
    select 1 from public.price_lists pl where pl.id = price_list_id
      and public.has_permission(auth.uid(), 'finance.manage', pl.store_id)))
  with check (exists (
    select 1 from public.price_lists pl where pl.id = price_list_id
      and public.has_permission(auth.uid(), 'finance.manage', pl.store_id)));

-- price_list_items
create policy pli_select on public.price_list_items for select using (true);
create policy pli_write on public.price_list_items for all to authenticated
  using (exists (
    select 1 from public.price_lists pl where pl.id = price_list_id
      and public.has_permission(auth.uid(), 'finance.manage', pl.store_id)))
  with check (exists (
    select 1 from public.price_lists pl where pl.id = price_list_id
      and public.has_permission(auth.uid(), 'finance.manage', pl.store_id)));

-- =========================================================
-- ETAPA 2 — Árvore de Categorias (reuso total da tabela)
-- =========================================================

-- 1) Novas colunas (NULL inicialmente; backfill preenche)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS level    smallint,
  ADD COLUMN IF NOT EXISTS depth    smallint,
  ADD COLUMN IF NOT EXISTS path_ids uuid[];

-- 2) Trigger BEFORE: calcula level/path_ids/path da própria linha,
--    valida parent (existência, mesma loja, ciclo, auto-referência).
CREATE OR REPLACE FUNCTION public.categories_compute_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_parent public.categories%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Categoria não pode ser pai de si mesma.'
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO v_parent
      FROM public.categories
     WHERE id = NEW.parent_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'parent_id inválido: categoria % não existe.', NEW.parent_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    IF v_parent.store_id <> NEW.store_id THEN
      RAISE EXCEPTION 'parent_id pertence a outra loja.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Ciclo: o novo pai não pode ser descendente do próprio nó
    IF TG_OP = 'UPDATE'
       AND v_parent.path_ids IS NOT NULL
       AND NEW.id = ANY(v_parent.path_ids) THEN
      RAISE EXCEPTION 'Ciclo detectado: categoria % não pode descender de si mesma.', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;

    NEW.level    := COALESCE(v_parent.level, 1) + 1;
    NEW.path_ids := COALESCE(v_parent.path_ids, ARRAY[v_parent.id]::uuid[]) || NEW.id;
    NEW.path     := COALESCE(v_parent.path, '') || '/' || NEW.slug;
  ELSE
    NEW.level    := 1;
    NEW.path_ids := ARRAY[NEW.id]::uuid[];
    NEW.path     := '/' || NEW.slug;
  END IF;

  -- depth da própria linha é recomputado em AFTER
  IF NEW.depth IS NULL THEN
    NEW.depth := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_compute_row ON public.categories;
CREATE TRIGGER trg_categories_compute_row
BEFORE INSERT OR UPDATE OF parent_id, slug
ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.categories_compute_row();

-- 3) Trigger AFTER: recomputa descendentes (level, path, path_ids)
--    e depth (altura de subárvore) para toda a loja afetada.
CREATE OR REPLACE FUNCTION public.categories_recompute_subtree()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_store uuid;
BEGIN
  v_store := COALESCE(
    (CASE WHEN TG_OP <> 'DELETE' THEN NEW.store_id END),
    (CASE WHEN TG_OP <> 'INSERT' THEN OLD.store_id END)
  );

  IF v_store IS NULL THEN
    RETURN NULL;
  END IF;

  -- Recalcula level/path/path_ids de todos os nós da loja
  WITH RECURSIVE tree AS (
    SELECT c.id, c.parent_id, c.slug, c.store_id,
           1::smallint                          AS level,
           ARRAY[c.id]::uuid[]                  AS path_ids,
           '/' || c.slug                        AS path
      FROM public.categories c
     WHERE c.parent_id IS NULL
       AND c.store_id = v_store
    UNION ALL
    SELECT c.id, c.parent_id, c.slug, c.store_id,
           (t.level + 1)::smallint,
           t.path_ids || c.id,
           t.path || '/' || c.slug
      FROM public.categories c
      JOIN tree t ON c.parent_id = t.id
     WHERE c.store_id = t.store_id
  )
  UPDATE public.categories c
     SET level    = t.level,
         path_ids = t.path_ids,
         path     = t.path
    FROM tree t
   WHERE c.id = t.id
     AND ( c.level    IS DISTINCT FROM t.level
        OR c.path_ids IS DISTINCT FROM t.path_ids
        OR c.path     IS DISTINCT FROM t.path );

  -- Recalcula depth (altura da subárvore) — folhas = 0
  WITH RECURSIVE up AS (
    SELECT c.id, c.parent_id, 0::smallint AS d
      FROM public.categories c
     WHERE c.store_id = v_store
       AND NOT EXISTS (
         SELECT 1 FROM public.categories ch
          WHERE ch.parent_id = c.id
       )
    UNION ALL
    SELECT p.id, p.parent_id, (u.d + 1)::smallint
      FROM public.categories p
      JOIN up u ON u.parent_id = p.id
     WHERE p.store_id = v_store
  ),
  agg AS (
    SELECT id, MAX(d)::smallint AS depth
      FROM up
     GROUP BY id
  )
  UPDATE public.categories c
     SET depth = a.depth
    FROM agg a
   WHERE c.id = a.id
     AND c.depth IS DISTINCT FROM a.depth;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_recompute_subtree ON public.categories;
CREATE TRIGGER trg_categories_recompute_subtree
AFTER INSERT OR DELETE OR UPDATE OF parent_id, slug
ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.categories_recompute_subtree();

-- 4) Backfill das categorias existentes (sem alterar UUID/FK)
WITH RECURSIVE tree AS (
  SELECT id, parent_id, slug, store_id,
         1::smallint AS level,
         ARRAY[id]::uuid[] AS path_ids,
         '/' || slug AS path
    FROM public.categories
   WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.parent_id, c.slug, c.store_id,
         (t.level + 1)::smallint,
         t.path_ids || c.id,
         t.path || '/' || c.slug
    FROM public.categories c
    JOIN tree t ON c.parent_id = t.id
)
UPDATE public.categories c
   SET level    = t.level,
       path_ids = t.path_ids,
       path     = t.path
  FROM tree t
 WHERE c.id = t.id;

WITH RECURSIVE up AS (
  SELECT c.id, c.parent_id, 0::smallint AS d
    FROM public.categories c
   WHERE NOT EXISTS (
     SELECT 1 FROM public.categories ch
      WHERE ch.parent_id = c.id
   )
  UNION ALL
  SELECT p.id, p.parent_id, (u.d + 1)::smallint
    FROM public.categories p
    JOIN up u ON u.parent_id = p.id
),
agg AS (
  SELECT id, MAX(d)::smallint AS depth
    FROM up
   GROUP BY id
)
UPDATE public.categories c
   SET depth = a.depth
  FROM agg a
 WHERE c.id = a.id;

-- 5) Índices
CREATE INDEX IF NOT EXISTS idx_categories_parent   ON public.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_level    ON public.categories (level);
CREATE INDEX IF NOT EXISTS idx_categories_path_ids ON public.categories USING GIN (path_ids);
CREATE INDEX IF NOT EXISTS idx_categories_path     ON public.categories (path);

-- 6) Trigger de validação em products: só permite categoria folha
--    quando o vínculo for criado ou alterado. Vínculos antigos seguem.
CREATE OR REPLACE FUNCTION public.products_category_must_be_leaf()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_children int;
  v_name     text;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_children
    FROM public.categories
   WHERE parent_id = NEW.category_id
     AND is_active = true;

  IF v_children > 0 THEN
    SELECT name INTO v_name
      FROM public.categories
     WHERE id = NEW.category_id;

    RAISE EXCEPTION
      'A categoria "%" possui subcategorias ativas. Selecione uma categoria-folha (mais específica) para o produto.',
      v_name
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_category_must_be_leaf ON public.products;
CREATE TRIGGER trg_products_category_must_be_leaf
BEFORE INSERT OR UPDATE OF category_id
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.products_category_must_be_leaf();

-- 7) View pronta para alimentar a Tree View do admin
CREATE OR REPLACE VIEW public.categories_tree AS
SELECT
  c.id,
  c.store_id,
  c.parent_id,
  c.name,
  c.slug,
  c.path,
  c.path_ids,
  c.level,
  c.depth,
  c.sort_order,
  c.is_active,
  ( SELECT count(*)::int
      FROM public.categories ch
     WHERE ch.parent_id = c.id )                              AS children_count,
  NOT EXISTS (
    SELECT 1 FROM public.categories ch WHERE ch.parent_id = c.id
  )                                                           AS is_leaf
FROM public.categories c;

GRANT SELECT ON public.categories_tree TO authenticated;
GRANT ALL    ON public.categories_tree TO service_role;
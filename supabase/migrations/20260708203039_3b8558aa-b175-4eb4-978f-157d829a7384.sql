
-- Fase B: Backfill hash + limpeza de metadata sensível.

-- 1) Backfill customers.doc_number_hash a partir de wholesale_applications.metadata
--    apenas quando: (a) hash ainda NULL, (b) sem colisão com outro cliente da mesma store.
WITH src AS (
  SELECT
    wa.id AS wa_id,
    c.id  AS customer_id,
    c.store_id,
    COALESCE(
      wa.metadata->>'cpf', wa.metadata->>'cnpj', wa.metadata->>'doc_number',
      wa.metadata->>'documento', wa.metadata->>'document', wa.metadata->>'cpf_cnpj',
      wa.metadata->>'docNumber', wa.metadata->>'tax_id', wa.metadata->>'doc',
      wa.metadata->>'CPF', wa.metadata->>'CNPJ'
    ) AS raw_doc
  FROM public.wholesale_applications wa
  JOIN public.customers c ON c.id = wa.customer_id
  WHERE c.doc_number_hash IS NULL
    AND c.deleted_at IS NULL
    AND (wa.metadata ?| array['cpf','cnpj','doc_number','documento','document','cpf_cnpj','docNumber','tax_id','doc','CPF','CNPJ'])
),
computed AS (
  SELECT customer_id, store_id, public.hash_doc_number(raw_doc) AS h
  FROM src
  WHERE raw_doc IS NOT NULL AND length(regexp_replace(raw_doc, '\D', '', 'g')) IN (11, 14)
),
safe AS (
  SELECT customer_id, h
  FROM computed comp
  WHERE h IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.customers c2
      WHERE c2.store_id = comp.store_id
        AND c2.id <> comp.customer_id
        AND c2.deleted_at IS NULL
        AND c2.doc_number_hash = comp.h
    )
)
UPDATE public.customers c
SET doc_number_hash = safe.h
FROM safe
WHERE c.id = safe.customer_id
  AND c.doc_number_hash IS NULL;

-- 2) Limpeza de chaves sensíveis em wholesale_applications.metadata
UPDATE public.wholesale_applications
SET metadata = COALESCE(metadata, '{}'::jsonb)
             - 'cpf' - 'cnpj' - 'doc' - 'doc_number'
             - 'documento' - 'document' - 'rg'
             - 'cpf_cnpj' - 'docNumber' - 'tax_id'
             - 'CPF' - 'CNPJ'
WHERE metadata ?| array['cpf','cnpj','doc','doc_number','documento','document','rg','cpf_cnpj','docNumber','tax_id','CPF','CNPJ'];

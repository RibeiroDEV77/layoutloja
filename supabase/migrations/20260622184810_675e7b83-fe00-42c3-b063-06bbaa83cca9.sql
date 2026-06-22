DO $mig$
DECLARE
  v_store uuid := '4ea8e8f6-fdab-493f-964a-2eeaad55fe4a';
  v_wh    uuid := '593a8fe6-713c-48a4-84ec-3958a42a9ba0';
  v_pl    uuid := 'a8eb4963-4b71-43fc-a1d6-1caf51e7235a';
  v_cat_calcas   uuid := '519fb43e-c6af-4cac-ab89-e33c6da59dcf';
  v_cat_bermudas uuid := 'e724aa5a-ab75-47ac-8bd7-54b1159334cc';

  v_sub_calcas_sport uuid;
  v_sub_calcas_country uuid;
  v_sub_bermudas_sport uuid;

  v_brand_bs uuid;
  v_brand_oreon uuid;

  v_attr_tecido uuid;
  v_attr_comp   uuid;

  v_av_tecido_sarja uuid;
  v_av_tecido_brim  uuid;
  v_av_tecido_jeans uuid;
  v_av_comp_a uuid;  -- 98% Algodão / 2% Elastano
  v_av_comp_b uuid;  -- 100% Algodão

  v_color_azul uuid := '1f925e15-287f-4cd9-b5c5-9c1632ce5c84';

  v_size_38 uuid := '659fcdb4-65ad-48d3-8478-f157e9dc136d';
  v_size_40 uuid := '41db866d-b033-4639-b138-ee1dc92f728e';
  v_size_42 uuid := '0e14b204-55ec-43ef-89e0-cf03c5b94f85';
  v_size_44 uuid := 'e1b3c57a-3538-449c-bd13-b4e5017f022e';
  v_size_46 uuid := '94011741-b1fd-4140-a04d-efbb310b8f06';

  v_p_id uuid;
  v_pc_id uuid;
  v_var_id uuid;
  v_size_id uuid;
  v_size_code text;
  v_color_name text;
  v_color_hex text;
  v_color_av uuid;
  v_seq int;

  v_weight_g int;
  v_length_mm int;
  v_width_mm int;
  v_height_mm int;
  v_price numeric;

  v_prod record;
  v_color record;
BEGIN
  -- =========================================================================
  -- SUBCATEGORIAS
  -- =========================================================================
  INSERT INTO categories (store_id, parent_id, name, slug, sort_order, is_active)
  VALUES
    (v_store, v_cat_calcas,   'Sport Fino', 'masc-calcas-sport-fino', 10, true),
    (v_store, v_cat_calcas,   'Country',    'masc-calcas-country',    20, true),
    (v_store, v_cat_calcas,   'Jeans',      'masc-calcas-jeans-sub',  30, true),
    (v_store, v_cat_calcas,   'Social',     'masc-calcas-social',     40, true),
    (v_store, v_cat_bermudas, 'Sport Fino', 'masc-bermudas-sport-fino', 10, true),
    (v_store, v_cat_bermudas, 'Jeans',      'masc-bermudas-jeans',      20, true),
    (v_store, v_cat_bermudas, 'Sarja',      'masc-bermudas-sarja',      30, true)
  ON CONFLICT (store_id, slug) DO NOTHING;

  SELECT id INTO v_sub_calcas_sport   FROM categories WHERE store_id=v_store AND slug='masc-calcas-sport-fino';
  SELECT id INTO v_sub_calcas_country FROM categories WHERE store_id=v_store AND slug='masc-calcas-country';
  SELECT id INTO v_sub_bermudas_sport FROM categories WHERE store_id=v_store AND slug='masc-bermudas-sport-fino';

  -- =========================================================================
  -- MARCAS
  -- =========================================================================
  INSERT INTO brands (store_id, name, slug, is_active, sort_order)
  VALUES
    (v_store, 'Brito & Storari', 'brito-storari', true, 10),
    (v_store, 'Oreon Jeans',     'oreon-jeans',   true, 20)
  ON CONFLICT (store_id, slug) DO NOTHING;

  SELECT id INTO v_brand_bs    FROM brands WHERE store_id=v_store AND slug='brito-storari';
  SELECT id INTO v_brand_oreon FROM brands WHERE store_id=v_store AND slug='oreon-jeans';

  -- =========================================================================
  -- ATRIBUTOS TECIDO + COMPOSIÇÃO
  -- =========================================================================
  INSERT INTO attributes (store_id, code, name, input_type, is_color, is_size, is_filterable, filter_ui, filter_order, is_public)
  VALUES
    (v_store, 'tecido',     'Tecido',     'select', false, false, true, 'checkbox', 50, true),
    (v_store, 'composicao', 'Composição', 'text',   false, false, false, 'checkbox', 60, true)
  ON CONFLICT (store_id, code) DO NOTHING;

  SELECT id INTO v_attr_tecido FROM attributes WHERE store_id=v_store AND code='tecido';
  SELECT id INTO v_attr_comp   FROM attributes WHERE store_id=v_store AND code='composicao';

  INSERT INTO attribute_values (attribute_id, code, label, sort_order, is_active) VALUES
    (v_attr_tecido, 'sarja', 'Sarja', 10, true),
    (v_attr_tecido, 'brim',  'Brim',  20, true),
    (v_attr_tecido, 'jeans', 'Jeans', 30, true)
  ON CONFLICT (attribute_id, code) DO NOTHING;

  INSERT INTO attribute_values (attribute_id, code, label, sort_order, is_active) VALUES
    (v_attr_comp, '98-algodao-2-elastano', '98% Algodão / 2% Elastano', 10, true),
    (v_attr_comp, '100-algodao',           '100% Algodão',              20, true)
  ON CONFLICT (attribute_id, code) DO NOTHING;

  SELECT id INTO v_av_tecido_sarja FROM attribute_values WHERE attribute_id=v_attr_tecido AND code='sarja';
  SELECT id INTO v_av_tecido_brim  FROM attribute_values WHERE attribute_id=v_attr_tecido AND code='brim';
  SELECT id INTO v_av_tecido_jeans FROM attribute_values WHERE attribute_id=v_attr_tecido AND code='jeans';
  SELECT id INTO v_av_comp_a FROM attribute_values WHERE attribute_id=v_attr_comp AND code='98-algodao-2-elastano';
  SELECT id INTO v_av_comp_b FROM attribute_values WHERE attribute_id=v_attr_comp AND code='100-algodao';

  -- =========================================================================
  -- PRODUTOS — função interna em loop
  -- =========================================================================
  FOR v_prod IN
    SELECT * FROM (VALUES
      -- (sku, name, slug, category_id, brand_id, price, descricao, tecido_av, composicao_av, weight_g, len_mm, wid_mm, hei_mm)
      ('BSF-001', 'Bermuda Sport Fino', 'bermuda-sport-fino',
        v_sub_bermudas_sport, v_brand_bs, 99.99::numeric,
        E'Conforto, elegância e liberdade de movimento em uma única peça. Nossa bermuda sport fino com elastano possui modelagem moderna e tecido de alta qualidade, proporcionando ajuste perfeito ao corpo sem abrir mão do conforto. Ideal para ocasiões casuais, passeios e momentos de lazer, combina facilmente com camisetas, polos e camisas.\n\n• Tecido com elastano para maior flexibilidade\n• Modelagem confortável\n• Acabamento premium\n• Ideal para diversas ocasiões',
        v_av_tecido_sarja, v_av_comp_a, 450, 350, 280, 40),
      ('CSF-001', 'Calça Sport Fino', 'calca-sport-fino',
        v_sub_calcas_sport, v_brand_bs, 139.99::numeric,
        E'Calça Sport Fino Masculina com Elastano une elegância, conforto e praticidade para o dia a dia. Confeccionada em tecido de alta qualidade com elastano, oferece excelente caimento, maior flexibilidade e liberdade de movimentos.',
        v_av_tecido_brim, v_av_comp_a, 700, 350, 300, 60),
      ('CCB-001', 'Calça Country Balão', 'calca-country-balao',
        v_sub_calcas_country, v_brand_oreon, 149.99::numeric,
        E'A Calça Country Balão combina conforto, estilo e resistência para o dia a dia. Confeccionada em tecido 100% algodão, proporciona toque macio, excelente respirabilidade e caimento confortável.',
        v_av_tecido_jeans, v_av_comp_b, 750, 350, 300, 60),
      ('CCE-001', 'Calça Country Elastano', 'calca-country-elastano',
        v_sub_calcas_country, v_brand_bs, 149.99::numeric,
        E'A Calça Jeans Masculina Country foi desenvolvida para quem busca conforto, resistência e estilo em uma única peça.',
        v_av_tecido_jeans, v_av_comp_a, 750, 350, 300, 60)
    ) AS t(sku, name, slug, cat, brand, price, descr, tec_av, comp_av, wg, lmm, wmm, hmm)
  LOOP
    -- Insere produto (idempotente)
    INSERT INTO products
      (store_id, name, sku_root, slug, category_id, brand_id, description,
       status, visibility, sale_channel, featured, new_product, best_seller, on_sale, published_at)
    VALUES
      (v_store, v_prod.name, v_prod.sku, v_prod.slug, v_prod.cat, v_prod.brand, v_prod.descr,
       'published', 'published', 'ambos', false, true, false, false, now())
    ON CONFLICT (store_id, sku_root) DO NOTHING;

    SELECT id INTO v_p_id FROM products WHERE store_id=v_store AND sku_root=v_prod.sku;

    -- product_attribute_values: tecido + composicao
    INSERT INTO product_attribute_values (product_id, attribute_id, attribute_value_id)
    VALUES
      (v_p_id, v_attr_tecido, v_prod.tec_av),
      (v_p_id, v_attr_comp,   v_prod.comp_av)
    ON CONFLICT (product_id, attribute_id, attribute_value_id) DO NOTHING;

    v_weight_g := v_prod.wg;
    v_length_mm := v_prod.lmm;
    v_width_mm := v_prod.wmm;
    v_height_mm := v_prod.hmm;
    v_price := v_prod.price;

    -- Define as cores deste produto
    -- BSF-001, CSF-001: cor padrão "Único"
    -- CCB-001: Azul
    -- CCE-001: Azul Claro, Azul Médio, Azul Escuro
    FOR v_color IN
      SELECT * FROM (
        SELECT 'Único'::text AS cname, '#222222'::text AS chex, NULL::uuid AS cav, 1 AS sord WHERE v_prod.sku IN ('BSF-001','CSF-001')
        UNION ALL
        SELECT 'Azul'::text, '#1F4E8C'::text, v_color_azul, 1 WHERE v_prod.sku = 'CCB-001'
        UNION ALL
        SELECT 'Azul Claro'::text, '#7CA7D9'::text, NULL::uuid, 1 WHERE v_prod.sku = 'CCE-001'
        UNION ALL
        SELECT 'Azul Médio'::text, '#3A6FB0'::text, NULL::uuid, 2 WHERE v_prod.sku = 'CCE-001'
        UNION ALL
        SELECT 'Azul Escuro'::text, '#1F3A66'::text, NULL::uuid, 3 WHERE v_prod.sku = 'CCE-001'
      ) c
    LOOP
      INSERT INTO product_colors (product_id, attribute_value_id, name, hex, sort_order, is_default, is_active)
      VALUES (v_p_id, v_color.cav, v_color.cname, v_color.chex, v_color.sord, v_color.sord=1, true)
      ON CONFLICT (product_id, name) DO NOTHING;

      SELECT id INTO v_pc_id FROM product_colors WHERE product_id=v_p_id AND name=v_color.cname;

      -- Tamanhos 38..46
      FOR v_size_code, v_size_id IN
        SELECT * FROM (VALUES
          ('38', v_size_38),
          ('40', v_size_40),
          ('42', v_size_42),
          ('44', v_size_44),
          ('46', v_size_46)
        ) AS s(code, id)
      LOOP
        INSERT INTO product_variants
          (product_id, product_color_id, size_attribute_value_id, sku,
           weight_grams, length_mm, width_mm, height_mm, is_active)
        VALUES
          (v_p_id, v_pc_id, v_size_id,
           v_prod.sku || '-' || regexp_replace(lower(v_color.cname),'[^a-z0-9]+','-','g') || '-' || v_size_code,
           v_weight_g, v_length_mm, v_width_mm, v_height_mm, true)
        ON CONFLICT (product_color_id, size_attribute_value_id) DO NOTHING;

        SELECT id INTO v_var_id FROM product_variants
          WHERE product_color_id=v_pc_id AND size_attribute_value_id=v_size_id;

        INSERT INTO stock_levels (store_id, warehouse_id, variant_id, quantity_on_hand, quantity_reserved, quantity_incoming)
        VALUES (v_store, v_wh, v_var_id, 0, 0, 0)
        ON CONFLICT (warehouse_id, variant_id) DO NOTHING;

        INSERT INTO price_list_items (price_list_id, variant_id, price, min_quantity)
        VALUES (v_pl, v_var_id, v_price, 1)
        ON CONFLICT (price_list_id, variant_id, min_quantity) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END
$mig$;
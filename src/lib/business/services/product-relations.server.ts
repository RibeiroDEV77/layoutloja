/**
 * Service: Produtos Relacionados (related / cross_sell / up_sell).
 *
 * Toda mutação verifica RBAC + escopo de loja e despacha eventos para o
 * Outbox (observability/auditoria reusam o pipeline existente do Products
 * Engine via DomainEvent.ProductUpdated com action específica).
 */
import type { SbClient } from '../events/dispatcher.server';
import { Errors } from '../errors';
import { dispatchEvent } from '../events/dispatcher.server';
import { DomainEvent } from '../events/types';
import {
  requirePermission, requireStoreAccess, isSuperAdmin, hasPermission,
} from './permissions.server';

export type RelationType = 'related' | 'cross_sell' | 'up_sell';

async function productStoreId(supabase: SbClient, productId: string): Promise<string> {
  const { data, error } = await supabase
    .from('products').select('store_id').eq('id', productId).maybeSingle();
  if (error) throw Errors.internal('Falha ao localizar produto', { error: error.message });
  if (!data) throw Errors.notFound('product', productId);
  return data.store_id as string;
}

async function ensureRead(supabase: SbClient, userId: string, storeId: string) {
  if (await isSuperAdmin(supabase, userId)) return;
  await requireStoreAccess(supabase, userId, storeId);
  if (await hasPermission(supabase, userId, 'products.read', storeId)) return;
  throw Errors.forbidden('Permissão necessária: products.read');
}

export async function listRelations(
  supabase: SbClient, userId: string, productId: string, relationType?: RelationType,
) {
  const storeId = await productStoreId(supabase, productId);
  await ensureRead(supabase, userId, storeId);

  let q = supabase
    .from('product_relations')
    .select('id, product_id, related_product_id, relation_type, position, created_at, related:products!product_relations_related_product_id_fkey(id, name, sku_root, slug, status, visibility)')
    .eq('product_id', productId);
  if (relationType) q = q.eq('relation_type', relationType);
  const { data, error } = await q.order('relation_type').order('position');
  if (error) throw Errors.internal('Falha ao listar produtos relacionados', { error: error.message });
  return data ?? [];
}

export async function addRelation(
  supabase: SbClient, userId: string, productId: string,
  input: { related_product_id: string; relation_type?: RelationType; position?: number },
) {
  const storeId = await productStoreId(supabase, productId);
  await requirePermission(supabase, userId, 'products.update', storeId);

  if (productId === input.related_product_id) {
    throw Errors.validation('Um produto não pode ser relacionado a si mesmo');
  }
  // Cross-store guard: relacionado precisa pertencer à mesma loja
  const relatedStoreId = await productStoreId(supabase, input.related_product_id);
  if (relatedStoreId !== storeId) {
    throw Errors.validation('Produto relacionado deve pertencer à mesma loja');
  }

  const relationType: RelationType = input.relation_type ?? 'related';
  const position = input.position ?? 0;

  const { data, error } = await supabase
    .from('product_relations')
    .insert({
      product_id: productId,
      related_product_id: input.related_product_id,
      relation_type: relationType,
      position,
      created_by: userId,
    })
    .select('id, product_id, related_product_id, relation_type, position')
    .single();

  if (error) {
    if (error.code === '23505') throw Errors.validation('Esta relação já existe');
    throw Errors.internal('Falha ao adicionar produto relacionado', { error: error.message });
  }

  await dispatchEvent(supabase, {
    event_type: DomainEvent.ProductUpdated,
    aggregate_type: 'product',
    aggregate_id: productId,
    store_id: storeId,
    payload: { action: 'relation_added', relation_type: relationType, related_product_id: input.related_product_id },
  });

  return data;
}

export async function removeRelation(
  supabase: SbClient, userId: string, relationId: string,
) {
  const { data: row, error: fetchErr } = await supabase
    .from('product_relations')
    .select('id, product_id, related_product_id, relation_type, product:products!product_relations_product_id_fkey(store_id)')
    .eq('id', relationId)
    .maybeSingle();
  if (fetchErr) throw Errors.internal('Falha ao localizar relação', { error: fetchErr.message });
  if (!row) throw Errors.notFound('product_relation', relationId);
  const storeId = (row as { product: { store_id: string } }).product.store_id;
  await requirePermission(supabase, userId, 'products.update', storeId);

  const { error } = await supabase.from('product_relations').delete().eq('id', relationId);
  if (error) throw Errors.internal('Falha ao remover produto relacionado', { error: error.message });

  await dispatchEvent(supabase, {
    event_type: DomainEvent.ProductUpdated,
    aggregate_type: 'product',
    aggregate_id: row.product_id,
    store_id: storeId,
    payload: { action: 'relation_removed', relation_type: row.relation_type, related_product_id: row.related_product_id },
  });
  return { ok: true };
}

export async function reorderRelations(
  supabase: SbClient, userId: string, productId: string,
  items: { id: string; position: number }[],
) {
  const storeId = await productStoreId(supabase, productId);
  await requirePermission(supabase, userId, 'products.update', storeId);

  for (const it of items) {
    const { error } = await supabase
      .from('product_relations')
      .update({ position: it.position })
      .eq('id', it.id)
      .eq('product_id', productId);
    if (error) throw Errors.internal('Falha ao reordenar relações', { error: error.message });
  }

  await dispatchEvent(supabase, {
    event_type: DomainEvent.ProductUpdated,
    aggregate_type: 'product',
    aggregate_id: productId,
    store_id: storeId,
    payload: { action: 'relations_reordered', count: items.length },
  });
  return { ok: true };
}

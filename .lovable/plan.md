# FASE 4.3 — Digital Asset Manager (DAM)

Módulo central e desacoplado para gerenciamento de todos os ativos digitais da plataforma. Nenhum outro módulo fará upload direto para o Storage — todos consomem o DAM via API única.

## 1. Princípios de arquitetura

- **Camada única de mídia**: produtos, categorias, marcas, coleções, banners, institucional e marketing referenciam `assets.id` via tabelas de junção polimórficas — nunca duplicam URL/caminho.
- **Storage-agnóstico**: o serviço expõe uma interface `StorageDriver` com duas implementações intercambiáveis:
  - `SupabaseStorageDriver` (quando o bucket `dam` existir)
  - `ExternalUrlDriver` (fallback atual — usuário cola URL; o DAM faz hash/validação/registro)
  A troca é transparente; consumidores não mudam.
- **Processamento server-side**: validação, hash, dedupe, EXIF strip e geração de variantes (thumb/medium/webp) acontecem em server functions; o cliente apenas envia bytes ou URL.
- **Imutabilidade do binário**: o arquivo original nunca é alterado. "Renomear / ALT / descrição / ordem" são metadados. Substituição cria uma nova **versão** (`asset_versions`).
- **Sem exclusão destrutiva por padrão**: arquivar → restaurar. Delete só permitido quando `usage_count = 0`.

## 2. Modelo de dados (novas tabelas)

```text
assets
  id, store_id, context (enum), kind (enum), status (active|archived)
  storage_driver (supabase|external|youtube|vimeo)
  bucket, storage_path, external_url, external_id   -- mutuamente exclusivos por kind
  mime, size_bytes, width, height, duration_seconds
  sha256 (UNIQUE por store_id quando não-nulo)      -- dedupe
  original_filename, title, alt_text, description, caption
  webp_path, thumb_path, medium_path                -- variantes geradas
  created_by, created_at, updated_at, archived_at

asset_versions            -- histórico ao "substituir arquivo"
  id, asset_id, version_no, storage_path, sha256, size_bytes, created_by, created_at

asset_tags / asset_tag_map  -- folksonomia interna do DAM
asset_folders               -- árvore opcional dentro de cada context

asset_links               -- onde o asset é usado (polimórfico)
  id, asset_id, owner_type (product|product_color|category|brand|collection|banner|page|...),
  owner_id, role (cover|hover|gallery|og|favicon|attachment|...),
  sort_order, created_at
  UNIQUE (asset_id, owner_type, owner_id, role, sort_order)

asset_upload_jobs         -- estado de uploads em progresso (retry/cancel/resume)
  id, store_id, user_id, filename, size_bytes, bytes_uploaded,
  status (pending|uploading|processing|done|failed|canceled),
  error, attempts, asset_id, created_at, updated_at
```

Triggers/funções:
- `assets_usage_count(asset_id)` — SECURITY DEFINER, conta `asset_links`.
- `prevent_delete_if_linked` — bloqueia `DELETE` quando há `asset_links`.
- `asset_store_id(asset_id)` — para RLS dos `asset_links` polimórficos.
- Auditoria via `audit_row_change` (já existente) anexado a `assets`, `asset_versions`, `asset_links`.

RLS / RBAC:
- `dam.read`, `dam.upload`, `dam.update`, `dam.archive`, `dam.delete`, `dam.link`.
- Políticas em `assets` e `asset_links` por `store_id` + `has_permission(...)`.
- `service_role` mantido para jobs internos.

## 3. Camada de serviço (server)

`src/lib/business/services/assets.server.ts`
- `listAssets({ context, kind, status, search, tags, folder, page })`
- `getAsset(id)` + `getAssetUsage(id)` (lista de `asset_links` resolvidos)
- `registerExternalAsset({ url|youtube|vimeo, context, ...meta })` — driver `external`
- `createUploadJob({ filename, size, mime, context })` → devolve `{ jobId, uploadTarget }`
- `completeUploadJob(jobId, { bytes_uploaded, sha256 })` → roda processamento
- `cancelUploadJob(jobId)`
- `updateAssetMeta(id, { title, alt, description, caption, tags, folder })`
- `archiveAsset(id)` / `restoreAsset(id)` / `deleteAsset(id)` (valida `usage_count=0`)
- `replaceAssetBinary(id, newJobId)` → grava em `asset_versions`
- `linkAsset({ assetId, ownerType, ownerId, role, sortOrder })` / `unlinkAsset(linkId)` / `reorderLinks(...)`
- `setCover(ownerType, ownerId, assetId)` / `setHover(...)`

Processamento (`assets.processor.server.ts`):
- Validação MIME × extensão × magic bytes
- Cálculo de `sha256` → dedupe por store
- EXIF strip
- Geração de `thumb` (256), `medium` (1024), `webp` (configurável por store em `store_settings.dam`)
- SVG: sanitização (remover `<script>`, `on*`, `xlink:href` externos)
- PDF: extrair primeira página como thumb (quando driver permitir)

`StorageDriver` interface:
```ts
type StorageDriver = {
  putObject(path, bytes, mime): Promise<{ path: string }>
  signedUrl(path, ttl?): Promise<string>
  publicUrl(path): string
  remove(path): Promise<void>
}
```
Implementações: `supabase` (bucket `dam`, privado por padrão + signed URLs), `external` (no-op put; armazena `external_url`).

## 4. Camada de controllers (server functions)

`src/lib/business/dam.functions.ts` — expõe TODAS as operações acima via `createServerFn` + `requireSupabaseAuth` + checagem de permissão. Único ponto de entrada para o cliente.

## 5. Camada de UI

`src/routes/_authenticated/admin.dam.tsx` — biblioteca completa:
- Sidebar de contextos + pastas + tags
- Grid/lista com filtro, busca, status (ativo/arquivado), seleção múltipla
- Drawer de detalhes (preview, metadados editáveis, versões, **"Usado em"** com links)
- Ações: arquivar, restaurar, excluir (desabilitado quando vinculado), substituir arquivo

`src/components/dam/` (consumido por TODOS os módulos):
- `<AssetPicker context kind multiple onSelect />` — modal único; aba **Biblioteca** + aba **Enviar**
- `<AssetUploader />` — dropzone, multi-arquivo, barra de progresso por item, cancelar, retry automático (exponencial, máx 3), pausa em background
- `<AssetThumb assetId />` — resolve URL via driver
- `<AssetLinksManager ownerType ownerId roles />` — usado por produtos/cores/categorias/banners para gerenciar capa/hover/galeria

Hook `useAssetUpload()` — fila client-side com `AbortController` por job, persistência em `localStorage` para resume após reload, sincronização com `asset_upload_jobs`.

## 6. Integração com módulos existentes (refactor)

- **product_color_media** → migra para `asset_links(owner_type='product_color', role in ('cover','hover','gallery'))`. Mantemos a tabela legada por compatibilidade até a migração de dados; nova UI grava só em `asset_links`.
- **categories.image_url / brands.logo_url / collections.cover_url** → passam a aceitar `asset_id` (FK) além do campo legado. UI substituída por `<AssetLinksManager>`.
- **products** (qualquer upload futuro) usa `<AssetPicker>`.
- Banners / institucional / marketing: criados já nativos no DAM.

## 7. Storage real vs fallback

Enquanto o bucket `dam` não existir:
- `createUploadJob` retorna `uploadTarget = { mode: 'external' }` e a UI exige URL externa (ou YouTube/Vimeo).
- Quando o bucket for habilitado, basta setar `store_settings.dam.driver = 'supabase'`; a UI passa a oferecer upload binário sem mudança de contrato.

## 8. Segurança

- RLS por `store_id` em `assets`, `asset_versions`, `asset_links`, `asset_upload_jobs`.
- Permissões `dam.*` no RBAC; super_admin bypass via `is_super_admin`.
- SVG sanitizado; bucket privado + signed URLs com TTL curto.
- Auditoria em todas as mutações; versionamento via `asset_versions`.
- Rate-limit de criação de jobs por usuário (campo `attempts` + janela).

## 9. Entregáveis desta fase

1. Migração: tabelas `assets`, `asset_versions`, `asset_links`, `asset_upload_jobs`, `asset_folders`, `asset_tags(_map)`, permissions, RLS, grants, triggers.
2. Serviços: `assets.server.ts`, `assets.processor.server.ts`, drivers em `src/lib/dam/storage/`.
3. Controllers: `dam.functions.ts`.
4. UI: rota `/admin/dam` + componentes reutilizáveis (`AssetPicker`, `AssetUploader`, `AssetThumb`, `AssetLinksManager`).
5. Refactor mínimo de cores/galeria de produto para usar `AssetLinksManager` (mantendo dados existentes).
6. Documentação curta em `.lovable/plan.md` sobre como módulos novos devem consumir o DAM.

## 10. Fora do escopo desta fase

- Migração de dados legados de `product_color_media` para `asset_links` (script separado).
- CDN edge / transformações on-the-fly (fica para fase de performance).
- Importação em massa via ZIP/CSV.

Aprovando esta arquitetura, sigo direto para a migração SQL (passo 1) e depois para serviços + UI.
---

## FASE 4.3 — DAM (entregue)

**Migração:** `assets`, `asset_folders`, `asset_tags(_map)`, `asset_versions`, `asset_links`, `asset_upload_jobs` + enums `asset_context/kind/status/driver/job_status`. Permissões `dam.read|upload|update|archive|delete|link` concedidas a `super_admin` e `admin`. Triggers: dedupe por sha256 (índice único), bloqueio de delete quando vinculado, consistência storage_driver↔campos, auditoria via `audit_row_change`.

**Serviço:** `src/lib/business/services/assets.server.ts` — listar/obter/uso, registrar (YouTube/Vimeo/URL detectados automaticamente), criar/cancelar/falhar upload jobs, atualizar metadados, arquivar/restaurar/excluir (bloqueia se vinculado), vincular/desvincular/reordenar links, pastas.

**Driver de Storage:** `src/lib/dam/storage/index.ts` com interface única (`prepareUpload`, `resolveUrl`, `remove`). Implementação atual `external` (URLs colados). Quando o bucket `dam` for habilitado, basta plugar `SupabaseStorageDriver` — contrato preservado.

**Controllers:** `src/lib/business/dam.functions.ts` — ÚNICO ponto de entrada do cliente.

**UI:**
- `/admin/dam` — biblioteca completa (filtros por contexto/status, busca, drawer de detalhes com utilização, arquivar/restaurar/excluir).
- `<AssetPicker context multiple onSelect>` — modal de seleção (aba Biblioteca + Enviar).
- `<AssetUploader />` — formulário de registro (URL/YouTube/Vimeo).
- `<AssetLinksManager ownerType ownerId role context />` — vínculos de entidade.
- `<AssetThumb asset />` — preview compacto.

**Regra arquitetural:** nenhum módulo (produtos, categorias, marcas, coleções, banners, institucional, marketing) deve gravar em Storage ou em colunas `*_url` próprias. Para anexar mídia, usar `<AssetPicker>` para gravar `asset_links`. O campo legado `product_color_media` continua existindo até a migração de dados.

**Fora do escopo:** upload binário nativo (bloqueado pela ausência do bucket), conversão WebP/thumbs server-side (depende do bucket), migração de dados legados, importação ZIP/CSV.

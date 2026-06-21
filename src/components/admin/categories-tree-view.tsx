/**
 * Tree View administrativa de Categorias (Etapa 3).
 *
 * - Consome exclusivamente `listCategoriesTree` (Etapa 2).
 * - CRUD via `createCategory`, `updateCategory`, `deleteCategory`.
 * - Triggers do banco recalculam level/depth/path/path_ids.
 * - Sem alterações em Engines, RLS, RBAC, banco ou migrations.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCategoriesTree,
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoryTreeNode,
} from "@/lib/business/categories.functions";
import { useActiveStore } from "@/hooks/use-active-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CrudDrawer } from "@/components/admin/crud-drawer";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField, FormRow } from "@/components/admin/form-field";
import { StatusBadge } from "@/components/admin/status-badge";
import { notify } from "@/components/admin/notify";
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, FileText,
  MoreHorizontal, Plus, Pencil, Copy, Archive, Trash2, Search, X, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  type DragEndEvent, useDraggable, useDroppable,
} from "@dnd-kit/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(s: string) {
  return s.toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

type TreeNode = CategoryTreeNode & { children: TreeNode[] };

function buildTree(rows: CategoryTreeNode[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  rows.forEach((r) => map.set(r.id, { ...r, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (arr: TreeNode[]) => {
    arr.sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

type FormState = {
  id?: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
};

const emptyForm = (parent_id: string | null = null): FormState => ({
  name: "", slug: "", parent_id, description: "", image_url: "",
  sort_order: 0, is_active: true,
});

const EXPANDED_KEY = "lovable.admin.categories.expanded";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CategoriesTreeView() {
  const { storeId } = useActiveStore();
  const qc = useQueryClient();
  const list = useServerFn(listCategoriesTree);
  const create = useServerFn(createCategory);
  const update = useServerFn(updateCategory);
  const remove = useServerFn(deleteCategory);

  const query = useQuery({
    queryKey: ["categories-tree", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const r = await list({ data: { store_id: storeId! } });
      if (!r.ok) throw new Error(r.error.message);
      return r.data.rows;
    },
  });

  const rows = query.data ?? [];
  const tree = useMemo(() => buildTree(rows), [rows]);
  const byId = useMemo(() => {
    const m = new Map<string, CategoryTreeNode>();
    rows.forEach((r) => m.set(r.id, r));
    return m;
  }, [rows]);

  // Expanded state (persisted)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const s = localStorage.getItem(EXPANDED_KEY);
      return s ? new Set<string>(JSON.parse(s)) : new Set<string>();
    } catch { return new Set(); }
  });
  useEffect(() => {
    try { localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded])); } catch {/* ignore */}
  }, [expanded]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Search & filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  const maxLevel = useMemo(() => rows.reduce((m, r) => Math.max(m, r.level ?? 0), 0), [rows]);

  // Matching ids and ancestors-to-expand on search
  const { matchedIds, autoExpand } = useMemo(() => {
    const matched = new Set<string>();
    const expand = new Set<string>();
    const term = search.trim().toLowerCase();
    if (!term) return { matchedIds: matched, autoExpand: expand };
    rows.forEach((r) => {
      const hay = `${r.name} ${r.slug} ${r.path ?? ""}`.toLowerCase();
      if (hay.includes(term)) {
        matched.add(r.id);
        (r.path_ids ?? []).forEach((id) => { if (id !== r.id) expand.add(id); });
      }
    });
    return { matchedIds: matched, autoExpand: expand };
  }, [rows, search]);

  // Filter predicate
  const passes = (n: TreeNode): boolean => {
    if (statusFilter === "active" && !n.is_active) return false;
    if (statusFilter === "archived" && n.is_active) return false;
    if (levelFilter !== "all" && String(n.level ?? 0) !== levelFilter) return false;
    if (search.trim()) {
      // include if itself matches OR any descendant matches
      const matches = matchedIds.has(n.id) || n.children.some(passes);
      return matches;
    }
    return true;
  };

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const openCreate = (parent_id: string | null = null) => {
    setForm(emptyForm(parent_id));
    setDrawerMode("create");
    setDrawerOpen(true);
  };
  const openEdit = (node: CategoryTreeNode) => {
    setForm({
      id: node.id,
      name: node.name,
      slug: node.slug,
      parent_id: node.parent_id,
      description: "",
      image_url: "",
      sort_order: node.sort_order,
      is_active: node.is_active,
    });
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const saveForm = async () => {
    if (!storeId) return;
    if (!form.name.trim() || !form.slug.trim()) {
      notify.error("Nome e slug são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      if (drawerMode === "create") {
        const r = await create({
          data: {
            store_id: storeId,
            name: form.name,
            slug: form.slug,
            parent_id: form.parent_id,
            description: form.description || null,
            image_url: form.image_url || null,
            sort_order: form.sort_order,
            is_active: form.is_active,
          },
        });
        if (!r.ok) throw new Error(r.error.message);
        notify.success("Categoria criada");
        if (form.parent_id) {
          setExpanded((prev) => new Set(prev).add(form.parent_id!));
        }
      } else if (form.id) {
        const r = await update({
          data: {
            id: form.id,
            patch: {
              name: form.name,
              slug: form.slug,
              parent_id: form.parent_id,
              sort_order: form.sort_order,
              is_active: form.is_active,
            },
          },
        });
        if (!r.ok) throw new Error(r.error.message);
        notify.success("Categoria atualizada");
      }
      setDrawerOpen(false);
      await qc.invalidateQueries({ queryKey: ["categories-tree", storeId] });
    } catch (e) {
      notify.error("Erro ao salvar", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Duplicate / archive / delete
  const duplicate = async (node: CategoryTreeNode) => {
    if (!storeId) return;
    try {
      const r = await create({
        data: {
          store_id: storeId,
          name: `${node.name} (cópia)`,
          slug: `${node.slug}-copia-${Date.now().toString(36)}`,
          parent_id: node.parent_id,
          sort_order: node.sort_order + 1,
          is_active: node.is_active,
        },
      });
      if (!r.ok) throw new Error(r.error.message);
      notify.success("Categoria duplicada");
      await qc.invalidateQueries({ queryKey: ["categories-tree", storeId] });
    } catch (e) {
      notify.error("Erro ao duplicar", (e as Error).message);
    }
  };

  const archive = async (node: CategoryTreeNode) => {
    try {
      const r = await update({
        data: { id: node.id, patch: { is_active: !node.is_active } },
      });
      if (!r.ok) throw new Error(r.error.message);
      notify.success(node.is_active ? "Categoria arquivada" : "Categoria reativada");
      await qc.invalidateQueries({ queryKey: ["categories-tree", storeId] });
    } catch (e) {
      notify.error("Erro ao alterar status", (e as Error).message);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<CategoryTreeNode | null>(null);
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const r = await remove({ data: { id: deleteTarget.id } });
      if (!r.ok) throw new Error(r.error.message);
      notify.success("Categoria excluída");
      setDeleteTarget(null);
      await qc.invalidateQueries({ queryKey: ["categories-tree", storeId] });
    } catch (e) {
      notify.error("Erro ao excluir", (e as Error).message);
    }
  };

  // Drag and drop
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const sourceId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId || sourceId === overId) return;

    const src = byId.get(sourceId);
    const tgt = byId.get(overId);
    if (!src || !tgt) return;

    // Cycle protection: target cannot be inside source's subtree
    if (tgt.path_ids?.includes(sourceId)) {
      notify.error("Movimento inválido", "Não é possível mover uma categoria para dentro de si mesma.");
      return;
    }
    if (src.parent_id === tgt.id) return; // no-op

    try {
      const r = await update({
        data: { id: sourceId, patch: { parent_id: tgt.id } },
      });
      if (!r.ok) throw new Error(r.error.message);
      notify.success(`"${src.name}" movida para "${tgt.name}"`);
      setExpanded((prev) => new Set(prev).add(tgt.id));
      await qc.invalidateQueries({ queryKey: ["categories-tree", storeId] });
    } catch (err) {
      notify.error("Erro ao mover", (err as Error).message);
    }
  };

  // Visible tree application
  const isExpanded = (id: string) => expanded.has(id) || autoExpand.has(id);

  const visibleTree = useMemo(() => {
    const filter = (arr: TreeNode[]): TreeNode[] =>
      arr.filter(passes).map((n) => ({ ...n, children: filter(n.children) }));
    return filter(tree);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, statusFilter, levelFilter, search, matchedIds]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar categoria por nome, slug ou path..."
              className="pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="archived">Arquivadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Nível" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os níveis</SelectItem>
              {Array.from({ length: maxLevel + 1 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>Nível {i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set(rows.map((r) => r.id)))}>
            Expandir tudo
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
            Recolher tudo
          </Button>
          <Button size="sm" onClick={() => openCreate(null)} className="gap-1">
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        </div>
      </div>

      {/* Tree */}
      <div className="rounded-lg border bg-card">
        {query.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando árvore...</div>
        ) : query.isError ? (
          <div className="p-8 text-center text-sm text-destructive">
            {(query.error as Error)?.message ?? "Erro ao carregar"}
          </div>
        ) : visibleTree.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {search ? "Nenhuma categoria encontrada." : "Nenhuma categoria cadastrada."}
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="py-2">
              {visibleTree.map((n) => (
                <TreeRow
                  key={n.id}
                  node={n}
                  depth={0}
                  isExpanded={isExpanded}
                  toggle={toggle}
                  highlight={matchedIds}
                  searching={!!search.trim()}
                  onCreateChild={(p) => openCreate(p)}
                  onEdit={openEdit}
                  onDuplicate={duplicate}
                  onArchive={archive}
                  onDelete={(n) => setDeleteTarget(n)}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>

      {/* Drawer (Create / Edit / Create child) */}
      <CrudDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={drawerMode === "create"
          ? (form.parent_id ? "Nova subcategoria" : "Nova categoria")
          : "Editar categoria"}
        description={form.parent_id
          ? `Filha de: ${byId.get(form.parent_id)?.name ?? ""}`
          : "Categoria raiz"}
        onSubmit={saveForm}
        loading={saving}
        submitLabel={drawerMode === "create" ? "Criar" : "Salvar"}
      >
        <div className="space-y-4">
          <FormRow>
            <FormField label="Nome" required>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug: f.slug || slugify(e.target.value),
                }))}
                autoFocus
              />
            </FormField>
            <FormField label="Slug" required hint="Identificador na URL.">
              <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} />
            </FormField>
          </FormRow>
          <FormField label="Descrição">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormRow>
            <FormField label="URL da imagem" hint="Em breve via DAM.">
              <Input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} />
            </FormField>
            <FormField label="Ordem">
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
              />
            </FormField>
          </FormRow>
          <FormField label="Ativa">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <span className="text-sm text-muted-foreground">
                {form.is_active ? "Visível no catálogo" : "Oculta"}
              </span>
            </div>
          </FormField>
        </div>
      </CrudDrawer>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Excluir categoria?"
        description={deleteTarget
          ? `"${deleteTarget.name}" será removida. Esta ação não pode ser desfeita.`
          : ""}
        confirmLabel="Excluir"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree row
// ---------------------------------------------------------------------------

type RowProps = {
  node: TreeNode;
  depth: number;
  isExpanded: (id: string) => boolean;
  toggle: (id: string) => void;
  highlight: Set<string>;
  searching: boolean;
  onCreateChild: (parentId: string) => void;
  onEdit: (n: CategoryTreeNode) => void;
  onDuplicate: (n: CategoryTreeNode) => void;
  onArchive: (n: CategoryTreeNode) => void;
  onDelete: (n: CategoryTreeNode) => void;
};

function TreeRow(props: RowProps) {
  const { node, depth, isExpanded, toggle, highlight, searching } = props;
  const hasChildren = node.children.length > 0;
  const open = isExpanded(node.id);
  const isMatch = searching && highlight.has(node.id);

  const drag = useDraggable({ id: node.id });
  const drop = useDroppable({ id: node.id });

  return (
    <div>
      <div
        ref={drop.setNodeRef}
        className={cn(
          "group relative flex items-center gap-2 px-2 py-1.5 hover:bg-accent/60 transition-colors",
          drop.isOver && "bg-primary/10 ring-1 ring-primary/40",
          isMatch && "bg-yellow-500/10",
        )}
        style={{ paddingLeft: 8 + depth * 20 }}
      >
        {/* Indentation guides */}
        {Array.from({ length: depth }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute top-0 bottom-0 w-px bg-border/60"
            style={{ left: 8 + i * 20 + 10 }}
          />
        ))}

        {/* Drag handle */}
        <button
          ref={drag.setNodeRef}
          {...drag.listeners}
          {...drag.attributes}
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-muted-foreground"
          aria-label="Arrastar"
          type="button"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Expand/collapse */}
        <button
          type="button"
          onClick={() => hasChildren && toggle(node.id)}
          className={cn(
            "shrink-0 grid h-5 w-5 place-items-center rounded text-muted-foreground hover:bg-muted",
            !hasChildren && "invisible",
          )}
          aria-label={open ? "Recolher" : "Expandir"}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Icon */}
        <span className="shrink-0 text-muted-foreground">
          {hasChildren ? (
            open ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-primary" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </span>

        {/* Name */}
        <span
          className={cn(
            "min-w-0 truncate text-sm font-medium",
            !node.is_active && "text-muted-foreground line-through",
          )}
          title={node.path ?? node.name}
        >
          {node.name}
        </span>

        {/* Indicators */}
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {node.children_count > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {node.children_count} {node.children_count === 1 ? "filho" : "filhos"}
            </Badge>
          )}
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            Nível {node.level ?? 0}
          </Badge>
          <StatusBadge
            label={node.is_active ? "Ativa" : "Arquivada"}
            tone={node.is_active ? "success" : "muted"}
            dot
          />

          {/* Quick create child */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100"
            onClick={() => props.onCreateChild(node.id)}
            title="Criar filho"
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => props.onEdit(node)}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => props.onCreateChild(node.id)}>
                <Plus className="mr-2 h-4 w-4" /> Criar filho
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => props.onDuplicate(node)}>
                <Copy className="mr-2 h-4 w-4" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => props.onArchive(node)}>
                <Archive className="mr-2 h-4 w-4" />
                {node.is_active ? "Arquivar" : "Reativar"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => props.onDelete(node)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>

      {open && hasChildren && (
        <div>
          {node.children.map((c) => (
            <TreeRow key={c.id} {...props} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function _unused(_: ReactNode) { /* keep type imports happy */ }
void _unused;

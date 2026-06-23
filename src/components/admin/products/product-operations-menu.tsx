/**
 * Operações do produto (Fase 4.2C) — menu de ações reutilizado na lista
 * e no header do Wizard.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Copy, Archive, ArchiveRestore, Download, History, Shield,
  ExternalLink, Share2, Trash2, MoreVertical,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { runAction, notify } from "@/components/admin/notify";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  duplicateProduct, archiveProduct, deleteProduct, exportProducts,
} from "@/lib/business/products.functions";
import { ProductHistoryDrawer } from "./product-history-drawer";

export interface ProductLite { id: string; name: string; slug: string; status: string; store_id?: string }

export function ProductOperationsMenu({
  product, storeId, compact = false,
}: { product: ProductLite; storeId: string | null; compact?: boolean }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fnDup = useServerFn(duplicateProduct);
  const fnArch = useServerFn(archiveProduct);
  const fnDel = useServerFn(deleteProduct);
  const fnExp = useServerFn(exportProducts);

  const [historyOpen, setHistoryOpen] = useState<"history" | "audit" | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const archived = product.status === "archived";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["product", product.id] });
    if (product.slug) {
      qc.invalidateQueries({ queryKey: ["storefront", "product", product.slug] });
    }
  };

  const onDuplicate = async () => {
    const res = await runAction(
      () => fnDup({ data: { id: product.id } }),
      { loading: "Duplicando...", success: "Produto duplicado" },
    );
    if (res) { invalidate(); navigate({ to: "/admin/products/$id/edit", params: { id: res.id } }); }
  };
  const onArchive = async () => {
    const ok = await runAction(
      () => fnArch({ data: { id: product.id, archived: !archived } }),
      { loading: archived ? "Restaurando..." : "Arquivando...", success: archived ? "Restaurado" : "Arquivado" },
    );
    if (ok) invalidate();
    setConfirmArchive(false);
  };
  const onDelete = async () => {
    const ok = await runAction(
      () => fnDel({ data: { id: product.id } }),
      { loading: "Excluindo...", success: "Produto excluído" },
    );
    if (ok) { invalidate(); navigate({ to: "/admin/products" }); }
    setConfirmDel(false);
  };
  const onExport = async () => {
    if (!storeId) return;
    const res = await runAction(
      () => fnExp({ data: { store_id: storeId } }),
      { loading: "Exportando...", success: "Exportação concluída" },
    );
    if (res) {
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `produtos-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
    }
  };
  const onShare = async () => {
    const url = `${window.location.origin}/produto/${product.slug}`;
    try { await navigator.clipboard.writeText(url); notify.success("Link copiado"); }
    catch { notify.error("Não foi possível copiar"); }
  };
  const onPreview = () => {
    window.open(`/produto/${product.slug}`, "_blank", "noopener");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {compact ? (
            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
          ) : (
            <Button variant="outline" size="sm"><MoreVertical className="h-4 w-4 mr-2" />Operações</Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuItem onClick={onDuplicate}><Copy className="h-4 w-4 mr-2" />Duplicar</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirmArchive(true)}>
            {archived ? <ArchiveRestore className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
            {archived ? "Restaurar" : "Arquivar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onPreview}><ExternalLink className="h-4 w-4 mr-2" />Preview na loja</DropdownMenuItem>
          <DropdownMenuItem onClick={onShare}><Share2 className="h-4 w-4 mr-2" />Compartilhar link</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setHistoryOpen("history")}><History className="h-4 w-4 mr-2" />Histórico</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setHistoryOpen("audit")}><Shield className="h-4 w-4 mr-2" />Auditoria</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExport}><Download className="h-4 w-4 mr-2" />Exportar catálogo</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setConfirmDel(true)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />Excluir produto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProductHistoryDrawer
        productId={product.id}
        mode={historyOpen}
        onClose={() => setHistoryOpen(null)}
      />

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={archived ? "Restaurar produto?" : "Arquivar produto?"}
        description={archived
          ? "O produto voltará ao estado de rascunho."
          : "O produto será ocultado da loja, mas pode ser restaurado depois."}
        confirmLabel={archived ? "Restaurar" : "Arquivar"}
        onConfirm={onArchive}
      />
      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title="Excluir produto?"
        description="Esta ação é permanente e remove cores, variantes, mídias e preços vinculados."
        confirmLabel="Excluir"
        destructive
        onConfirm={onDelete}
      />
    </>
  );
}

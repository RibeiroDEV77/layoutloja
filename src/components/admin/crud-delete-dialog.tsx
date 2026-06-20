import { ConfirmDialog } from "./confirm-dialog";

export type CrudDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceName?: string;
  itemLabel?: string;
  onConfirm: () => void | Promise<void>;
};

export function CrudDeleteDialog({
  open, onOpenChange, resourceName = "registro", itemLabel, onConfirm,
}: CrudDeleteDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      destructive
      title={`Excluir ${resourceName}?`}
      description={
        <>
          Esta ação não pode ser desfeita.
          {itemLabel && (<> O {resourceName} <strong>{itemLabel}</strong> será removido permanentemente.</>)}
        </>
      }
      confirmLabel="Excluir"
      onConfirm={onConfirm}
    />
  );
}

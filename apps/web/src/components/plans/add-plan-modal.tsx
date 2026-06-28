"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { PermGrid, PermItem } from "@/components/dashboard/perm-item";
import { createPlan, updatePlan } from "@/actions/plans";
import type { ApiPermission, ApiPlan } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Plan name is required"),
  // permissionId -> raw quota input. "" means the permission is excluded.
  quotas: z.record(z.string(), z.string()),
});

type FormValues = z.infer<typeof schema>;

interface AddPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: ApiPermission[];
  editingPlan?: ApiPlan | null;
}

export function AddPlanModal({
  open,
  onOpenChange,
  permissions,
  editingPlan,
}: AddPlanModalProps) {
  const isEditing = Boolean(editingPlan);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", quotas: {} },
  });

  useEffect(() => {
    if (open) {
      if (editingPlan) {
        reset({
          name: editingPlan.title,
          quotas: Object.fromEntries(
            editingPlan.permissions.map((p) => [
              p.id,
              p.totalOperation == null ? "" : String(p.totalOperation),
            ])
          ),
        });
      } else {
        reset({ name: "", quotas: {} });
      }
    }
  }, [open, editingPlan, reset]);

  const onSubmit = async (values: FormValues) => {
    // Empty inputs are excluded; everything else must be a whole number >= -1.
    const planPermissions: { permissionId: string; totalOperation: number }[] = [];
    for (const [permissionId, raw] of Object.entries(values.quotas)) {
      const trimmed = raw.trim();
      if (trimmed === "") continue;
      const totalOperation = Number(trimmed);
      if (!Number.isInteger(totalOperation) || totalOperation < -1) {
        toast.error("Quotas must be whole numbers (use -1 for unlimited)");
        return;
      }
      planPermissions.push({ permissionId, totalOperation });
    }

    try {
      if (isEditing && editingPlan) {
        await updatePlan(editingPlan.id, {
          name: values.name,
          permissions: planPermissions,
        });
        toast.success("Plan updated");
      } else {
        await createPlan({
          name: values.name,
          permissions: planPermissions,
        });
        toast.success("Plan created");
      }
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-135">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit plan" : "New plan"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the plan name and the quota each permission grants."
                : "Name the plan and set the quota each permission grants."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label="Plan Name" error={errors.name?.message}>
              <Input placeholder="e.g. Pro" {...register("name")} />
            </FormField>
            <FormField label="Quotas">
              <p className="mb-2 text-[0.72rem] text-text-muted">
                Set how many operations each permission allows. Leave blank to
                exclude it. Use -1 for unlimited.
              </p>
              <PermGrid>
                {permissions.map((perm) => (
                  <PermItem
                    key={perm.id}
                    name={perm.name}
                    scope={`${perm.action} · ${perm.subject}`}
                  >
                    <Input
                      type="number"
                      step={1}
                      min={-1}
                      placeholder="—"
                      className="w-20"
                      {...register(`quotas.${perm.id}`)}
                    />
                  </PermItem>
                ))}
              </PermGrid>
            </FormField>
          </DialogBody>
          <DialogFooter className="justify-end gap-2.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                  ? "Update plan"
                  : "Create plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

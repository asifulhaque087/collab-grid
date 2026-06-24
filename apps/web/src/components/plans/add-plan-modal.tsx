"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { PermGrid, PermItem } from "@/components/dashboard/perm-item";
import { createPlan, updatePlan } from "@/actions/plans";
import type { ApiPermission, ApiPlan } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Plan name is required"),
  permissionIds: z.array(z.string()),
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
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", permissionIds: [] },
  });

  useEffect(() => {
    if (open) {
      if (editingPlan) {
        reset({
          name: editingPlan.title,
          permissionIds: editingPlan.permissions.map((p) => p.id),
        });
      } else {
        reset({ name: "", permissionIds: [] });
      }
    }
  }, [open, editingPlan, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && editingPlan) {
        await updatePlan(editingPlan.id, {
          name: values.name,
          permissionIds: values.permissionIds,
        });
        toast.success("Plan updated");
      } else {
        await createPlan({
          name: values.name,
          permissionIds: values.permissionIds,
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
                ? "Update the plan name and its permissions."
                : "Name the plan and choose the permissions it grants."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label="Plan Name" error={errors.name?.message}>
              <Input placeholder="e.g. Pro" {...register("name")} />
            </FormField>
            <FormField label="Permissions">
              <Controller
                control={control}
                name="permissionIds"
                render={({ field }) => (
                  <PermGrid>
                    {permissions.map((perm) => (
                      <PermItem
                        key={perm.id}
                        name={perm.name}
                        scope={`${perm.action} · ${perm.subject}`}
                      >
                        <Switch
                          checked={field.value.includes(perm.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, perm.id]
                                : field.value.filter((id) => id !== perm.id)
                            )
                          }
                        />
                      </PermItem>
                    ))}
                  </PermGrid>
                )}
              />
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

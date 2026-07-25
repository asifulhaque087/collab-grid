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
import { createRole, updateRole } from "@/actions/roles";
import type { ApiPermission, ApiRole } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Role name is required"),
  permissionIds: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

interface AddRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: ApiPermission[];
  editingRole?: ApiRole | null;
}

export function AddRoleModal({
  open,
  onOpenChange,
  permissions,
  editingRole,
}: AddRoleModalProps) {
  const isEditing = Boolean(editingRole);

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
      if (editingRole) {
        reset({
          name: editingRole.title,
          permissionIds: editingRole.permissions.map((p) => p.id),
        });
      } else {
        reset({ name: "", permissionIds: [] });
      }
    }
  }, [open, editingRole, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && editingRole) {
        await updateRole(editingRole.id, {
          name: values.name,
          permissionIds: values.permissionIds,
        });
        toast.success("Role updated");
      } else {
        await createRole({
          name: values.name,
          permissionIds: values.permissionIds,
        });
        toast.success("Role created");
      }
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit role" : "New role"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the role name and its permissions."
                : "Name the role and choose the permissions it grants."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label="Role Name" error={errors.name?.message}>
              <Input placeholder="e.g. Store Supervisor" {...register("name")} />
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
                  ? "Update role"
                  : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

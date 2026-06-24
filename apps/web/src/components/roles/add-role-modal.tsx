"use client";

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

const PERMISSIONS = [
  { id: "board:create", name: "Create boards", scope: "create · Board", default: true },
  { id: "board:read", name: "Read boards", scope: "read · Board", default: true },
  { id: "board:delete", name: "Delete boards", scope: "delete · Board", default: false },
  { id: "board:manage", name: "Publish boards", scope: "manage · Board", default: true },
  { id: "inventory:create", name: "Create inventory", scope: "create · Inventory", default: true },
  { id: "inventory:read", name: "Read inventory", scope: "read · Inventory", default: true },
  { id: "inventory:update", name: "Update inventory", scope: "update · Inventory", default: false },
  { id: "inventory:delete", name: "Delete inventory", scope: "delete · Inventory", default: false },
  { id: "order:read", name: "Read orders", scope: "read · Order", default: false },
  { id: "user:manage", name: "Manage users", scope: "manage · User", default: false },
  { id: "role:manage", name: "Manage roles", scope: "manage · Role", default: false },
  { id: "transaction:read", name: "Read transactions", scope: "read · Transaction", default: false },
];

const DEFAULT_PERMS = PERMISSIONS.filter((p) => p.default).map((p) => p.id);

const schema = z.object({
  name: z.string().min(1, "Role name is required"),
  permissions: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

export function AddRoleModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", permissions: DEFAULT_PERMS },
  });

  const onSubmit = () => {
    onOpenChange(false);
    reset();
    toast.success("Role created");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New role</DialogTitle>
            <DialogDescription>
              Name the role and choose the permissions it grants.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label="Role Name" error={errors.name?.message}>
              <Input placeholder="e.g. Store Supervisor" {...register("name")} />
            </FormField>
            <FormField label="Permissions">
              <Controller
                control={control}
                name="permissions"
                render={({ field }) => (
                  <PermGrid>
                    {PERMISSIONS.map((perm) => (
                      <PermItem key={perm.id} name={perm.name} scope={perm.scope}>
                        <Switch
                          checked={field.value.includes(perm.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, perm.id]
                                : field.value.filter((p) => p !== perm.id)
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
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create role</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

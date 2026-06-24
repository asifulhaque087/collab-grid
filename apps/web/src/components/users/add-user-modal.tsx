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
import { FormField, FormRow } from "@/components/ui/form-field";
import { Switch } from "@/components/ui/switch";
import { PermGrid, PermItem } from "@/components/dashboard/perm-item";

const ROLES = [
  { id: "tenant-admin", name: "Tenant Admin", scope: "Full access to all resources" },
  { id: "retail-manager", name: "Retail Manager", scope: "Boards, Inventory, Orders" },
  { id: "inventory-clerk", name: "Inventory Clerk", scope: "Inventory only" },
];

const schema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  roles: z.array(z.string()).min(1, "Assign at least one role"),
});

type FormValues = z.infer<typeof schema>;

export function AddUserModal({
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
    defaultValues: { fullName: "", email: "", roles: [] },
  });

  const onSubmit = () => {
    onOpenChange(false);
    reset();
    toast.success("User added successfully");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New user</DialogTitle>
            <DialogDescription>
              Invite a team member and assign one or more roles.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormRow>
              <FormField label="Full Name" error={errors.fullName?.message}>
                <Input placeholder="e.g. Tanvir Ahmed" {...register("fullName")} />
              </FormField>
              <FormField label="Email Address" error={errors.email?.message}>
                <Input type="email" placeholder="user@company.com" {...register("email")} />
              </FormField>
            </FormRow>
            <FormField label="Assign Roles" error={errors.roles?.message}>
              <Controller
                control={control}
                name="roles"
                render={({ field }) => (
                  <PermGrid className="max-h-none">
                    {ROLES.map((role) => (
                      <PermItem key={role.id} name={role.name} scope={role.scope}>
                        <Switch
                          checked={field.value.includes(role.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, role.id]
                                : field.value.filter((r) => r !== role.id)
                            )
                          }
                        />
                      </PermItem>
                    ))}
                    <PermItem name="+ Create new role" scope="via Roles page" disabled>
                      <Switch disabled />
                    </PermItem>
                  </PermGrid>
                )}
              />
            </FormField>
          </DialogBody>
          <DialogFooter className="justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

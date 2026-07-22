"use client";

import { useEffect, useMemo } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
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
import { PasswordInput } from "@/components/auth/password-input";
import { createUser, updateUser } from "@/actions/users";
import type { ApiRole, ApiUser } from "@/types";

const baseSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  roleIds: z.array(z.string()).min(1, "Assign at least one role"),
});

type FormValues = z.infer<typeof baseSchema> & {
  password: string;
  confirmPassword: string;
};

interface AddUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: ApiRole[];
  editingUser?: ApiUser | null;
}

export function AddUserModal({
  open,
  onOpenChange,
  roles,
  editingUser,
}: AddUserModalProps) {
  const isEditing = Boolean(editingUser);

  const resolver = useMemo(
    () =>
      isEditing
        ? zodResolver(
            baseSchema
              .extend({
                password: z.string().optional(),
                confirmPassword: z.string().optional(),
              })
              .refine(
                (data) => {
                  if (!data.password && !data.confirmPassword) return true;
                  return data.password === data.confirmPassword;
                },
                { message: "Passwords do not match", path: ["confirmPassword"] },
              ),
          )
        : zodResolver(
            baseSchema
              .extend({
                password: z.string().min(8, "Password must be at least 8 characters"),
                confirmPassword: z.string().min(1, "Please confirm your password"),
              })
              .refine((data) => data.password === data.confirmPassword, {
                message: "Passwords do not match",
                path: ["confirmPassword"],
              }),
          ),
    [isEditing],
  ) as Resolver<FormValues>;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver,
    defaultValues: { name: "", email: "", password: "", confirmPassword: "", roleIds: [] },
  });

  useEffect(() => {
    if (open) {
      if (editingUser) {
        reset({
          name: editingUser.name,
          email: editingUser.email,
          password: "",
          confirmPassword: "",
          roleIds: editingUser.roles.map((r) => r.id),
        });
      } else {
        reset({ name: "", email: "", password: "", confirmPassword: "", roleIds: [] });
      }
    }
  }, [open, editingUser, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (isEditing && editingUser) {
        await updateUser(editingUser.id, {
          name: values.name,
          email: values.email,
          ...(values.password ? { password: values.password } : {}),
          roleIds: values.roleIds,
        });
        toast.success("User updated");
      } else {
        await createUser({
          name: values.name,
          email: values.email,
          password: values.password,
          roleIds: values.roleIds,
        });
        toast.success("User created");
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
            <DialogTitle>{isEditing ? "Edit user" : "New user"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update user details and role assignments."
                : "Invite a team member and assign one or more roles."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormRow>
              <FormField label="Full Name" error={errors.name?.message}>
                <Input placeholder="e.g. Tanvir Ahmed" {...register("name")} />
              </FormField>
              <FormField label="Email Address" error={errors.email?.message}>
                <Input type="email" placeholder="user@company.com" {...register("email")} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Password" error={errors.password?.message}>
                <PasswordInput
                  placeholder={isEditing ? "Leave blank to keep current" : "At least 8 characters"}
                  {...register("password")}
                />
              </FormField>
              <FormField label="Confirm Password" error={errors.confirmPassword?.message}>
                <PasswordInput
                  placeholder="Re-enter your password"
                  {...register("confirmPassword")}
                />
              </FormField>
            </FormRow>
            <FormField label="Assign Roles" error={errors.roleIds?.message}>
              <Controller
                control={control}
                name="roleIds"
                render={({ field }) => (
                  <PermGrid className="max-h-none">
                    {roles.map((role) => (
                      <PermItem key={role.id} name={role.title} scope={`${role.memberCount} member${role.memberCount !== 1 ? "s" : ""}`}>
                        <Switch
                          checked={field.value.includes(role.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, role.id]
                                : field.value.filter((id) => id !== role.id)
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
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEditing
                  ? "Saving…"
                  : "Creating…"
                : isEditing
                  ? "Update user"
                  : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

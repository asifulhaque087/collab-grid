"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function SecurityForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  return (
    <form
      onSubmit={handleSubmit(() => {
        reset();
        toast.success("Password updated");
      })}
      className="mb-5 rounded-md border border-border bg-surface p-[18px]"
    >
      <div className="mb-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-text-muted">
        Security
      </div>
      <FormField label="Current Password" error={errors.currentPassword?.message}>
        <Input type="password" placeholder="••••••••" {...register("currentPassword")} />
      </FormField>
      <FormField label="New Password" error={errors.newPassword?.message}>
        <Input type="password" placeholder="••••••••" {...register("newPassword")} />
      </FormField>
      <Button type="submit" size="sm">
        Update Password
      </Button>
    </form>
  );
}

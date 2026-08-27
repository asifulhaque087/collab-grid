"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

const schema = z.object({
  tenantName: z.string().min(1, "Tenant name is required"),
  tenantSlug: z.string().min(1, "Slug is required"),
  contactEmail: z.string().email("Enter a valid email"),
});

type FormValues = z.infer<typeof schema>;

export function ProfileForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenantName: "Aarong",
      tenantSlug: "aarong",
      contactEmail: "asifulhaque087@gmail.com",
    },
  });

  return (
    <form
      onSubmit={handleSubmit(() => toast.success("Profile updated"))}
      className="mb-5 rounded-md border border-border bg-surface p-[18px]"
    >
      <div className="mb-3.5 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-text-muted">
        Profile
      </div>
      <FormField label="Tenant Name" error={errors.tenantName?.message}>
        <Input {...register("tenantName")} />
      </FormField>
      <FormField label="Tenant Slug" error={errors.tenantSlug?.message}>
        <Input className="font-mono text-[0.82rem]" {...register("tenantSlug")} />
      </FormField>
      <FormField label="Contact Email" error={errors.contactEmail?.message}>
        <Input {...register("contactEmail")} />
      </FormField>
      <Button type="submit" size="sm">
        Save Changes
      </Button>
    </form>
  );
}

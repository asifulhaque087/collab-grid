"use client";

import { useEffect } from "react";
import { useForm, useController, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Minus, Plus, Infinity as InfinityIcon } from "lucide-react";
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
import { createPackage, updatePackage, type PackagePermissionQuota } from "@/actions/packages";
import type { ApiPermission, ApiPackage } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Package name is required"),
  price: z.string().min(1, "Price is required"),
  quotas: z.record(z.string(), z.string()),
});

type FormValues = z.infer<typeof schema>;

function QuotaField({
  control,
  name,
}: {
  control: Control<FormValues>;
  name: `quotas.${string}`;
}) {
  const { field } = useController({ control, name, defaultValue: "" });
  const raw = field.value ?? "";
  const num = raw === "" ? null : Number(raw);
  const isUnlimited = raw === "-1";

  const set = (v: number | null) => field.onChange(v === null ? "" : String(v));

  const dec = () => {
    if (num === null || Number.isNaN(num)) return;
    set(Math.max(-1, num - 1));
  };
  const inc = () => {
    if (num === null || Number.isNaN(num) || isUnlimited) return set(0);
    set(num + 1);
  };

  return (
    <div className="flex h-8 items-center overflow-hidden rounded-md border border-border bg-bg transition-colors focus-within:border-active">
      <button
        type="button"
        tabIndex={-1}
        onClick={dec}
        disabled={num === null || isUnlimited}
        className="flex h-full w-7 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-muted"
      >
        <Minus className="size-3.5" />
      </button>
      {isUnlimited ? (
        <button
          type="button"
          onClick={inc}
          title="Unlimited — click to set a number"
          className="flex h-full w-12 items-center justify-center text-active"
        >
          <InfinityIcon className="size-4" />
        </button>
      ) : (
        <input
          type="number"
          step={1}
          min={-1}
          value={raw}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          placeholder="—"
          className="no-spinner h-full w-12 bg-transparent text-center font-mono text-[0.85rem] text-text outline-none placeholder:text-text-muted"
        />
      )}
      <button
        type="button"
        tabIndex={-1}
        onClick={inc}
        className="flex h-full w-7 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

interface AddPackageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: ApiPermission[];
  editingPackage?: ApiPackage | null;
}

export function AddPackageModal({
  open,
  onOpenChange,
  permissions,
  editingPackage,
}: AddPackageModalProps) {
  const isEditing = Boolean(editingPackage);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", price: "", quotas: {} },
  });

  useEffect(() => {
    if (open) {
      if (editingPackage) {
        reset({
          name: editingPackage.title,
          price: editingPackage.price,
          quotas: Object.fromEntries(
            editingPackage.permissions.map((p) => [
              p.id,
              p.limit == null ? "" : String(p.limit),
            ])
          ),
        });
      } else {
        reset({ name: "", price: "", quotas: {} });
      }
    }
  }, [open, editingPackage, reset]);

  const onSubmit = async (values: FormValues) => {
    const packagePermissions: PackagePermissionQuota[] = [];
    for (const [permissionId, raw] of Object.entries(values.quotas)) {
      const trimmed = raw.trim();
      if (trimmed === "") continue;
      const limit = Number(trimmed);
      if (!Number.isInteger(limit) || limit < -1) {
        toast.error("Quotas must be whole numbers (use -1 for unlimited)");
        return;
      }
      packagePermissions.push({ permissionId, limit });
    }

    try {
      if (isEditing && editingPackage) {
        await updatePackage(editingPackage.id, {
          name: values.name,
          price: values.price,
          permissions: packagePermissions,
        });
        toast.success("Package updated");
      } else {
        await createPackage({
          name: values.name,
          price: values.price,
          permissions: packagePermissions,
        });
        toast.success("Package created");
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
            <DialogTitle>{isEditing ? "Edit package" : "New package"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the package name and the quota each permission grants."
                : "Name the package and set the quota each permission grants."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormField label="Package Name" error={errors.name?.message}>
              <Input placeholder="e.g. Pro" {...register("name")} />
            </FormField>
            <FormField label="Monthly Price" error={errors.price?.message}>
              <Input placeholder="e.g. 9.99" {...register("price")} />
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
                    <QuotaField control={control} name={`quotas.${perm.id}`} />
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
                  ? "Update package"
                  : "Create package"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

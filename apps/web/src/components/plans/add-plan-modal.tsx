"use client";

import { useForm, type UseFormRegister } from "react-hook-form";
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
import { PermGrid, PermItem } from "@/components/dashboard/perm-item";

const QUOTAS = [
  { id: "maxBoards", name: "Max boards", scope: "resource · Board", value: 2 },
  { id: "widgetsPerBoard", name: "Widgets per board", scope: "resource · Widget", value: 25 },
  { id: "customRoles", name: "Custom roles", scope: "resource · Role", value: 3 },
  { id: "maxUsers", name: "Max users", scope: "resource · User", value: 5 },
  { id: "inventoryItems", name: "Inventory items", scope: "resource · Inventory", value: 100 },
  { id: "maxConcurrentUsers", name: "Max concurrent users", scope: "limit · Connection", value: 50 },
  { id: "snapshotHistory", name: "Snapshot history", scope: "resource · Snapshot", value: 10 },
  { id: "csvImportsPerMonth", name: "CSV imports / month", scope: "limit · Import", value: 5 },
] as const;

type QuotaKey = (typeof QUOTAS)[number]["id"];

const schema = z.object({
  name: z.string().min(1, "Plan name is required"),
  pricePerMonth: z.number().nonnegative(),
  maxBoards: z.number().int().nonnegative(),
  widgetsPerBoard: z.number().int().nonnegative(),
  customRoles: z.number().int().nonnegative(),
  maxUsers: z.number().int().nonnegative(),
  inventoryItems: z.number().int().nonnegative(),
  maxConcurrentUsers: z.number().int().nonnegative(),
  snapshotHistory: z.number().int().nonnegative(),
  csvImportsPerMonth: z.number().int().nonnegative(),
});

type FormValues = z.infer<typeof schema>;

function QuotaRow({
  id,
  name,
  scope,
  register,
}: {
  id: QuotaKey;
  name: string;
  scope: string;
  register: UseFormRegister<FormValues>;
}) {
  return (
    <PermItem name={name} scope={scope}>
      <Input
        type="number"
        min={0}
        className="w-16 appearance-none bg-surface px-2 py-1.5 text-center font-mono font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        {...register(id, { valueAsNumber: true })}
      />
    </PermItem>
  );
}

export function AddPlanModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      pricePerMonth: 9,
      ...Object.fromEntries(QUOTAS.map((q) => [q.id, q.value])),
    } as FormValues,
  });

  const onSubmit = () => {
    onOpenChange(false);
    reset();
    toast.success("Plan created");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>New plan</DialogTitle>
            <DialogDescription>
              Name the plan, set the price, and define resource quotas.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <FormRow>
              <FormField label="Plan Name" error={errors.name?.message}>
                <Input placeholder="e.g. Business" {...register("name")} />
              </FormField>
              <FormField label="Price / Month" error={errors.pricePerMonth?.message}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[0.85rem] font-semibold text-text-muted">
                    $
                  </span>
                  <Input
                    type="number"
                    className="pl-7 font-mono"
                    {...register("pricePerMonth", { valueAsNumber: true })}
                  />
                </div>
              </FormField>
            </FormRow>
            <FormField label="Quotas">
              <PermGrid>
                {QUOTAS.map((q) => (
                  <QuotaRow
                    key={q.id}
                    id={q.id}
                    name={q.name}
                    scope={q.scope}
                    register={register}
                  />
                ))}
              </PermGrid>
            </FormField>
          </DialogBody>
          <DialogFooter className="justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create plan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

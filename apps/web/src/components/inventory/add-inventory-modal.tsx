"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormRow } from "@/components/ui/form-field";

const schema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Item name is required"),
  initialQuantity: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AddInventoryModal({
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
      sku: "",
      name: "",
      initialQuantity: 50,
      lowStockThreshold: 10,
      description: "",
    },
  });

  const onSubmit = () => {
    onOpenChange(false);
    reset();
    toast.success("Inventory item added — ready to link to a widget");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormField label="SKU Code" error={errors.sku?.message}>
              <Input className="font-mono" placeholder="e.g. SKU-8200" {...register("sku")} />
            </FormField>
            <FormField label="Item Name" error={errors.name?.message}>
              <Input placeholder="e.g. Hand-woven Silk Saree" {...register("name")} />
            </FormField>
            <FormRow>
              <FormField label="Initial Quantity" error={errors.initialQuantity?.message}>
                <Input
                  type="number"
                  className="font-mono"
                  {...register("initialQuantity", { valueAsNumber: true })}
                />
              </FormField>
              <FormField label="Low Stock Threshold" error={errors.lowStockThreshold?.message}>
                <Input
                  type="number"
                  className="font-mono"
                  {...register("lowStockThreshold", { valueAsNumber: true })}
                />
              </FormField>
            </FormRow>
            <FormField label="Description (optional)" error={errors.description?.message}>
              <Input
                placeholder="Brief description of this inventory item"
                {...register("description")}
              />
            </FormField>
          </DialogBody>
          <DialogFooter className="justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Plus />
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createInventory, updateInventory } from "@/actions/inventory";
import type { ApiInventory } from "@/types";

export interface BoardChoice {
  id: string;
  name: string;
}

// Fields mirror smartWidgetTable's writable columns. Coordinates (posX/posY)
// and canvas size are intentionally absent — items get those once dragged.
const schema = z.object({
  name: z.string().min(1, "Item name is required"),
  sku: z.string().min(1, "SKU is required"),
  quantity: z.number().int().nonnegative(),
  price: z
    .string()
    .optional()
    .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid price"),
  photo: z.string().optional(),
  boardId: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const NO_BOARD = "__none__";

export function AddInventoryModal({
  open,
  onOpenChange,
  item,
  boardId,
  boards,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing item; omit to create. */
  item?: ApiInventory;
  /** Preset board (board card / canvas editor). Locks the item to this board. */
  boardId?: string | null;
  /** Board options for the attach selector (inventory dashboard). */
  boards?: BoardChoice[];
  /** Called with the created/updated item — used by the canvas sidebar. */
  onSuccess?: (item: ApiInventory) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(item);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      sku: "",
      quantity: 1,
      price: "",
      photo: "",
      boardId: boardId ?? undefined,
    },
  });

  // Reset the form whenever the dialog opens so create/edit start clean.
  useEffect(() => {
    if (!open) return;
    reset({
      name: item?.name ?? "",
      sku: item?.sku ?? "",
      quantity: item?.quantity ?? 1,
      price: item?.price ?? "",
      photo: item?.photo ?? "",
      boardId: item?.boardId ?? boardId ?? undefined,
    });
  }, [open, item, boardId, reset]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        const payload = {
          name: values.name,
          sku: values.sku,
          quantity: values.quantity,
          price: values.price || undefined,
          photo: values.photo || undefined,
          boardId: values.boardId ?? boardId ?? null,
        };

        const saved: ApiInventory = isEdit
          ? await updateInventory(item!.id, payload)
          : await createInventory(payload);

        onOpenChange(false);
        reset();
        onSuccess?.(saved);
        toast.success(isEdit ? "Inventory item updated" : "Inventory item added");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Inventory Item" : "Add Inventory Item"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormField label="Item Name" error={errors.name?.message}>
              <Input placeholder="e.g. Hand-woven Silk Saree" {...register("name")} />
            </FormField>
            <FormField label="SKU Code" error={errors.sku?.message}>
              <Input className="font-mono" placeholder="e.g. SKU-8200" {...register("sku")} />
            </FormField>
            <FormRow>
              <FormField label="Quantity" error={errors.quantity?.message}>
                <Input
                  type="number"
                  className="font-mono"
                  {...register("quantity", { valueAsNumber: true })}
                />
              </FormField>
              <FormField label="Price (৳)" error={errors.price?.message}>
                <Input className="font-mono" placeholder="e.g. 4500" {...register("price")} />
              </FormField>
            </FormRow>
            <FormField label="Photo URL (optional)" error={errors.photo?.message}>
              <Input placeholder="https://…" {...register("photo")} />
            </FormField>
            {boards && (
              <FormField label="Attach to Board (optional)">
                <Controller
                  control={control}
                  name="boardId"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? NO_BOARD}
                      onValueChange={(v) => field.onChange(v === NO_BOARD ? undefined : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Not attached" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_BOARD}>Not attached</SelectItem>
                        {boards.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
            )}
          </DialogBody>
          <DialogFooter className="justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              <Plus />
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

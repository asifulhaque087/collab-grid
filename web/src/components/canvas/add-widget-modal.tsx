"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Boxes, Info, Image as ImageIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";

const TYPES = [
  { id: "product", label: "Product", icon: Boxes },
  { id: "info", label: "Info", icon: Info },
  { id: "media", label: "Media", icon: ImageIcon },
] as const;

const schema = z.object({
  type: z.enum(["product", "info", "media"]),
  name: z.string().min(1, "Widget name is required"),
  sku: z.string().optional(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

type FormValues = z.infer<typeof schema>;

export function AddWidgetModal({
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
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "product", name: "", sku: "", x: 240, y: 180, width: 200, height: 200 },
  });

  const onSubmit = (values: FormValues) => {
    onOpenChange(false);
    reset();
    toast.success(`Widget placed on canvas at (${values.x}, ${values.y})`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add Widget to Board</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormField label="Widget Type">
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <div className="grid grid-cols-3 gap-2.5">
                    {TYPES.map((t) => {
                      const Icon = t.icon;
                      const selected = field.value === t.id;
                      return (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => field.onChange(t.id)}
                          className={cn(
                            "group flex flex-col items-center gap-2 rounded-md border bg-bg px-3 py-4.5 transition-all",
                            selected
                              ? "border-active bg-active-dim shadow-[0_0_0_1px_var(--color-active)]"
                              : "border-border hover:border-active hover:bg-active-dim"
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-10 place-items-center rounded-sm transition-all [&_svg]:size-5",
                              selected
                                ? "bg-active text-white"
                                : "bg-surface text-text-dim group-hover:bg-active group-hover:text-white"
                            )}
                          >
                            <Icon />
                          </span>
                          <span className="text-[0.78rem] font-semibold text-text-dim">
                            {t.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </FormField>
            <FormField label="Widget Name" error={errors.name?.message}>
              <Input placeholder="e.g. Summer Saree — SKU-4821" {...register("name")} />
            </FormField>
            <FormField label="Link to SKU (optional)">
              <Select onValueChange={(v) => setValue("sku", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an inventory item…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SKU-4821">SKU-4821 — Jamdani Saree (Qty: 45)</SelectItem>
                  <SelectItem value="SKU-1203">SKU-1203 — Kantha Stitch Scarf (Qty: 120)</SelectItem>
                  <SelectItem value="SKU-0087">SKU-0087 — Nakshi Kantha (Qty: 30)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormRow>
              <FormField label="Canvas Position X" error={errors.x?.message}>
                <Input type="number" className="font-mono" {...register("x", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Canvas Position Y" error={errors.y?.message}>
                <Input type="number" className="font-mono" {...register("y", { valueAsNumber: true })} />
              </FormField>
            </FormRow>
            <FormRow>
              <FormField label="Width (px)" error={errors.width?.message}>
                <Input type="number" className="font-mono" {...register("width", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Height (px)" error={errors.height?.message}>
                <Input type="number" className="font-mono" {...register("height", { valueAsNumber: true })} />
              </FormField>
            </FormRow>
          </DialogBody>
          <DialogFooter className="justify-end gap-2.5">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Plus />
              Place Widget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

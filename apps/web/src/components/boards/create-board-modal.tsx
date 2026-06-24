"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FormField, FormRow } from "@/components/ui/form-field";

const schema = z.object({
  name: z.string().min(1, "Board name is required"),
  slug: z.string().min(1, "Slug is required"),
  maxCanvasWidth: z.number().int().positive(),
  maxCanvasHeight: z.number().int().positive(),
  access: z.enum(["restricted", "public"]),
});

type FormValues = z.infer<typeof schema>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function CreateBoardModal({
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
    control,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slug: "",
      maxCanvasWidth: 10000,
      maxCanvasHeight: 10000,
      access: "restricted",
    },
  });

  const name = useWatch({ control, name: "name" });
  useEffect(() => {
    setValue("slug", slugify(name));
  }, [name, setValue]);

  const onSubmit = () => {
    onOpenChange(false);
    reset();
    toast.success("Board created — redirecting to canvas…");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create New Board</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormField label="Board Name" error={errors.name?.message}>
              <Input placeholder="e.g. Eid Collection Launch" {...register("name")} />
            </FormField>
            <FormField label="Board Slug" error={errors.slug?.message}>
              <Input
                className="font-mono text-[0.8rem]"
                placeholder="auto-generated from name"
                {...register("slug")}
              />
            </FormField>
            <FormRow>
              <FormField label="Max Canvas Width" error={errors.maxCanvasWidth?.message}>
                <Input
                  type="number"
                  className="font-mono"
                  {...register("maxCanvasWidth", { valueAsNumber: true })}
                />
              </FormField>
              <FormField label="Max Canvas Height" error={errors.maxCanvasHeight?.message}>
                <Input
                  type="number"
                  className="font-mono"
                  {...register("maxCanvasHeight", { valueAsNumber: true })}
                />
              </FormField>
            </FormRow>
            <FormField label="Access" error={errors.access?.message}>
              <Select
                defaultValue="restricted"
                onValueChange={(v) => setValue("access", v as FormValues["access"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restricted">Restricted — Invite only</SelectItem>
                  <SelectItem value="public">Public — Anyone with the link</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </DialogBody>
          <DialogFooter>
            <span className="text-[0.78rem] text-text-muted">3 of 5 boards remaining</span>
            <Button type="submit">
              <Plus />
              Create Board
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

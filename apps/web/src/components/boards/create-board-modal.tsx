"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Save } from "lucide-react";
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
import { createBoard, updateBoard } from "@/actions/boards";
import type { ApiBoard } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Board name is required"),
  maxWidth: z.number().int().positive(),
  maxHeight: z.number().int().positive(),
  access: z.enum(["restricted", "public"]),
});

type FormValues = z.infer<typeof schema>;

export function CreateBoardModal({
  open,
  onOpenChange,
  board,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board?: ApiBoard;
}) {
  const isEdit = Boolean(board);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      maxWidth: 10000,
      maxHeight: 10000,
      access: "restricted",
    },
  });

  const access = useWatch({ control, name: "access" });

  useEffect(() => {
    if (!open) return;
    reset({
      name: board?.name ?? "",
      maxWidth: board?.maxWidth ?? 10000,
      maxHeight: board?.maxHeight ?? 10000,
      access: board?.access ?? "restricted",
    });
  }, [open, board, reset]);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      if (isEdit && board) {
        await updateBoard(board.id, values);
        toast.success(`"${values.name}" updated`);
      } else {
        await createBoard(values);
        toast.success(`"${values.name}" created`);
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Board" : "Create New Board"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <FormField label="Board Name" error={errors.name?.message}>
              <Input placeholder="e.g. Eid Collection Launch" {...register("name")} />
            </FormField>
            <FormRow>
              <FormField label="Max Canvas Width" error={errors.maxWidth?.message}>
                <Input
                  type="number"
                  className="font-mono"
                  {...register("maxWidth", { valueAsNumber: true })}
                />
              </FormField>
              <FormField label="Max Canvas Height" error={errors.maxHeight?.message}>
                <Input
                  type="number"
                  className="font-mono"
                  {...register("maxHeight", { valueAsNumber: true })}
                />
              </FormField>
            </FormRow>
            <FormField label="Access" error={errors.access?.message}>
              <Select
                value={access}
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
            <Button type="submit" disabled={submitting}>
              {isEdit ? <Save /> : <Plus />}
              {submitting
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save Changes"
                  : "Create Board"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

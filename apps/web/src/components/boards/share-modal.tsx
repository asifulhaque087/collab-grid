"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LayoutGrid, Mail, X, Lock, Globe, Link2, Check } from "lucide-react";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  role: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

interface Person {
  id: string;
  name: string;
  email: string;
  initials: string;
  gradient: string;
  role: string;
  you?: boolean;
}

const people: Person[] = [
  {
    id: "p1",
    name: "Asiful Haque",
    email: "asifulhaque087@gmail.com",
    initials: "AM",
    gradient: "linear-gradient(135deg,#2548a8,#0d9488)",
    role: "owner",
    you: true,
  },
  {
    id: "p2",
    name: "Rafiq Khan",
    email: "rafiq.khan@aarong.com",
    initials: "RK",
    gradient: "linear-gradient(135deg,#7c3aed,#6366f1)",
    role: "editor",
  },
];

export function ShareModal({
  open,
  onOpenChange,
  boardName = "Friday Flash Sale",
  boardSlug = "friday-flash-sale",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardName?: string;
  boardSlug?: string;
}) {
  const [accessMode, setAccessMode] = useState<"restricted" | "public">("restricted");
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "viewer" },
  });

  const onInvite = (values: FormValues) => {
    reset({ email: "", role: values.role });
    toast.success(`Invitation sent to ${values.email}`);
  };

  const copyLink = async () => {
    const url = `https://collabgrid.app/b/${boardSlug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard may be unavailable */
    }
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Share board</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {/* Board label */}
          <div className="mb-5 flex items-center gap-2.5 rounded-sm border border-border bg-bg p-3.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-sm bg-active-dim text-active">
              <LayoutGrid className="size-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="text-[0.9rem] font-semibold text-text">{boardName}</div>
              <div className="font-mono text-[0.72rem] text-text-muted">
                collabgrid.app/b/{boardSlug}
              </div>
            </div>
          </div>

          {/* Invite */}
          <form onSubmit={handleSubmit(onInvite)} className="mb-5 flex gap-2">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
              <input
                placeholder="Add people by email address"
                className="w-full rounded-sm border border-border bg-bg py-2.5 pl-9 pr-3 text-[0.85rem] text-text outline-none transition-colors placeholder:text-text-muted focus:border-active"
                {...register("email")}
              />
              {errors.email && (
                <p className="mt-1 text-[0.72rem] text-danger">{errors.email.message}</p>
              )}
            </div>
            <Button type="submit" variant="secondary">
              Invite
            </Button>
          </form>

          {/* People with access */}
          <div className="mb-3 text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-text-muted">
            People with access
          </div>
          <div className="mb-5">
            {people.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-3 border-t border-border-subtle py-2.5 first:border-t-0"
              >
                <div
                  className="grid size-9 shrink-0 place-items-center rounded-full text-[0.8rem] font-semibold text-white"
                  style={{ background: person.gradient }}
                >
                  {person.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[0.875rem] font-semibold text-text">
                    {person.name}
                    {person.you && (
                      <span className="rounded-[4px] bg-bg px-1.5 py-px text-[0.68rem] font-medium text-text-muted">
                        You
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[0.78rem] text-text-muted">{person.email}</div>
                </div>
                {person.you ? (
                  <span className="px-2.5 text-[0.8rem] font-medium text-text-muted">Owner</span>
                ) : (
                  <>
                    <Select defaultValue={person.role}>
                      <SelectTrigger className="w-auto border-transparent bg-transparent px-2.5 py-1.5 text-[0.8rem] font-medium text-text-dim hover:border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      title="Remove access"
                      onClick={() => toast.success(`Removed ${person.name}`)}
                      className="grid size-7 place-items-center rounded-sm text-text-muted transition-all hover:bg-danger-dim hover:text-danger"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* General access */}
          <div className="rounded-md border border-border bg-bg p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full transition-all",
                  accessMode === "public"
                    ? "bg-active-dim text-active"
                    : "bg-surface text-text-muted"
                )}
              >
                {accessMode === "public" ? (
                  <Globe className="size-[18px]" />
                ) : (
                  <Lock className="size-[18px]" />
                )}
              </div>
              <div className="flex-1">
                <Select
                  value={accessMode}
                  onValueChange={(v) => setAccessMode(v as "restricted" | "public")}
                >
                  <SelectTrigger className="w-auto border-transparent bg-transparent px-2 py-1 text-[0.875rem] font-semibold text-text hover:border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restricted">Restricted</SelectItem>
                    <SelectItem value="public">Anyone with the link</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-0.5 px-2 text-[0.78rem] text-text-muted">
                  {accessMode === "public"
                    ? "Anyone with the link can join this board"
                    : "Only people you add can access this board"}
                </div>
              </div>
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <button
            onClick={copyLink}
            className={cn(
              "inline-flex items-center gap-[7px] rounded-sm border border-border bg-bg px-3.5 py-2 text-[0.82rem] font-semibold text-text-dim transition-all hover:border-active hover:bg-active-dim hover:text-active",
              copied && "border-committed bg-committed-dim text-committed hover:border-committed hover:bg-committed-dim hover:text-committed"
            )}
          >
            {copied ? <Check className="size-[15px]" /> : <Link2 className="size-[15px]" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

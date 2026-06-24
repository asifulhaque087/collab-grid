"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { AuthCard } from "@/components/auth/auth-card";
import { forgotPasswordAction } from "@/actions/auth";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/lib/auth-schemas";

export function ForgotPasswordForm() {
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    const result = await forgotPasswordAction(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSentMessage(result.data.message);
  };

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link href="/sign-in" className="font-semibold text-active hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sentMessage ? (
        <p className="rounded-sm border border-active/20 bg-active-dim px-4 py-3 text-[0.85rem] text-text">
          {sentMessage}
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              {...register("email")}
            />
          </FormField>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/auth/password-input";
import { resetPasswordAction } from "@/actions/auth";
import {
  resetPasswordFormSchema,
  type ResetPasswordFormValues,
} from "@/lib/auth-schemas";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    // confirmPassword is client-only — send just the API fields.
    const result = await resetPasswordAction({
      token: values.token,
      password: values.password,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(result.data.message);
    router.replace("/sign-in");
  };

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a new password for your account."
      footer={
        <Link href="/sign-in" className="font-semibold text-active hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <input type="hidden" {...register("token")} />
        <FormField
          label="New password"
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...register("password")}
          />
        </FormField>
        <FormField
          label="Confirm Password"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            {...register("confirmPassword")}
          />
        </FormField>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthCard>
  );
}

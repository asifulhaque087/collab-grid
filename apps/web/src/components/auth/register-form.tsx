"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { AuthCard, AuthDivider } from "@/components/auth/auth-card";
import { GoogleButton } from "@/components/auth/google-button";
import { PasswordInput } from "@/components/auth/password-input";
import { registerAction } from "@/actions/auth";
import {
  registerFormSchema,
  type RegisterFormValues,
} from "@/lib/auth-schemas";

export function RegisterForm({ googleAuthUrl }: { googleAuthUrl: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    // confirmPassword is client-only — send just the API fields.
    const result = await registerAction({
      name: values.name,
      email: values.email,
      password: values.password,
    });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Account created");
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start building real-time boards in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-active hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton href={googleAuthUrl} label="Sign up with Google" />
      <AuthDivider />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Name" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Jane Cooper"
            {...register("name")}
          />
        </FormField>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register("email")}
          />
        </FormField>
        <FormField
          label="Password"
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
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthCard>
  );
}

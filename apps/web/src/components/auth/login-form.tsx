"use client";

import { useEffect } from "react";
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
import { extractErrorMessage } from "@/lib/errors";
import { loginSchema, type LoginValues } from "@/lib/auth-schemas";

export function LoginForm({
  googleAuthUrl,
  credentialPreset,
}: {
  googleAuthUrl: string;
  credentialPreset?: { email: string; password: string } | null;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (credentialPreset) {
      setValue("email", credentialPreset.email);
      setValue("password", credentialPreset.password);
    }
  }, [credentialPreset, setValue]);

  const onSubmit = async (values: LoginValues) => {
    // console.log("@@@@@@@@@@@@@@@@@@ 1")
    const res = await fetch("/api/public/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(extractErrorMessage(data, "Login failed"));
      return;
    }
    toast.success("Signed in");
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your CollabGrid workspace."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-semibold text-active hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <GoogleButton href={googleAuthUrl} label="Sign in with Google" />
      <AuthDivider />
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} />
        </FormField>
        <FormField label="Password" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
        </FormField>
        <div className="mb-4 -mt-1 text-right">
          <Link href="/forgot-password" className="text-[0.8rem] text-text-dim hover:text-text">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}

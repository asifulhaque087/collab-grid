import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthCard } from "@/components/auth/auth-card";

export const metadata: Metadata = {
  title: "Set a new password — CollabGrid",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthCard
        title="Invalid reset link"
        subtitle="This password reset link is missing or malformed."
        footer={
          <Link
            href="/forgot-password"
            className="font-semibold text-active hover:underline"
          >
            Request a new link
          </Link>
        }
      >
        <p className="text-[0.85rem] text-text-dim">
          Please request a fresh password reset email and try again.
        </p>
      </AuthCard>
    );
  }

  return <ResetPasswordForm token={token} />;
}

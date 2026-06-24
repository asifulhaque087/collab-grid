import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { googleAuthUrl } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in — CollabGrid",
};

export default function LoginPage() {
  return <LoginForm googleAuthUrl={googleAuthUrl()} />;
}

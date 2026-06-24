import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { googleAuthUrl } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create account — CollabGrid",
};

export default function RegisterPage() {
  return <RegisterForm googleAuthUrl={googleAuthUrl()} />;
}

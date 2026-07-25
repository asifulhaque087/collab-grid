"use client";

import { useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { CredentialsModal } from "@/components/auth/credentials-modal";

export function SignInClient({ googleAuthUrl }: { googleAuthUrl: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [credentialPreset, setCredentialPreset] = useState<{
    email: string;
    password: string;
  } | null>(null);

  return (
    <>
      <LoginForm
        googleAuthUrl={googleAuthUrl}
        credentialPreset={credentialPreset}
        onOpenModal={() => setModalOpen(true)}
      />
      <CredentialsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onFillCredentials={(email, password) => {
          setCredentialPreset({ email, password });
          setModalOpen(false);
        }}
      />
    </>
  );
}

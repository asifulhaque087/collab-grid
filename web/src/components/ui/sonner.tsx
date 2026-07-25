"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = (props: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!bg-surface !border-border !text-text !rounded-md !shadow-[var(--shadow-lg)] !font-ui",
          success: "!text-text",
          error: "!text-text",
          info: "!text-text",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

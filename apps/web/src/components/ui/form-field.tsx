import { Label } from "./label";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  htmlFor,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mb-4", className)}>
      <Label htmlFor={htmlFor} className="mb-1.5 uppercase">
        {label}
      </Label>
      {children}
      {error && <p className="mt-1.5 text-[0.72rem] text-danger">{error}</p>}
    </div>
  );
}

export function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

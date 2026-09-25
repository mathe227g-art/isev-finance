"use client";
import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";
export function SubmitButton({
  children,
  pendingLabel = "Aguarde…",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
      {pending ? (
        <LoaderCircle size={18} className="spin" />
      ) : (
        <ArrowRight size={18} />
      )}
    </button>
  );
}

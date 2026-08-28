import { Loader2 } from "lucide-react";

export function GlobalLoaderOverlay({ message }: { message: string }) {
  return (
    <div
      className="bg-background/80 fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message}
    >
      <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

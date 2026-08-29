import Link from "next/link";

export function LegalFooter() {
  return (
    <footer className="border-t border-white/5 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 text-sm text-white/35 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link
          href="/"
          className="font-heading font-medium text-white/50 hover:text-white/70"
        >
          Lead SaaS
        </Link>
        <div className="flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-white/70">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white/70">
            Terms
          </Link>
          <Link href="/data-deletion" className="hover:text-white/70">
            Data deletion
          </Link>
          <Link href="/login" className="hover:text-white/70">
            Sign in
          </Link>
        </div>
      </div>
    </footer>
  );
}

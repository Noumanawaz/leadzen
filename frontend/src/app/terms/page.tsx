import type { Metadata } from "next";
import { TermsOfServicePage } from "@/features/marketing/components/terms-of-service-page";

export const metadata: Metadata = {
  title: "Terms of Service | Lead SaaS",
  description: "Terms of Service for Lead SaaS lead management and outreach platform.",
};

export default function Page() {
  return <TermsOfServicePage />;
}

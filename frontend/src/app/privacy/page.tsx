import type { Metadata } from "next";
import { PrivacyPolicyPage } from "@/features/marketing/components/privacy-policy-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Lead SaaS",
  description:
    "How Lead SaaS collects, uses, discloses, and protects personal data, including Meta WhatsApp Business integrations.",
};

export default function Page() {
  return <PrivacyPolicyPage />;
}

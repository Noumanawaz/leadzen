import type { Metadata } from "next";
import { DataDeletionPage } from "@/features/marketing/components/data-deletion-page";

export const metadata: Metadata = {
  title: "Data Deletion Instructions | Lead SaaS",
  description:
    "How to request deletion of your Lead SaaS account data, including Meta WhatsApp integration data.",
};

export default function Page() {
  return <DataDeletionPage />;
}

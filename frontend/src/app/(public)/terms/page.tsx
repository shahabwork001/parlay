import type { Metadata } from "next";
import { TermsContent } from "@/features/legal/components/terms-content";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Page() {
  return <TermsContent />;
}

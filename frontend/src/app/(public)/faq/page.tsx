import type { Metadata } from "next";
import { FaqContent } from "@/features/legal/components/faq-content";

export const metadata: Metadata = { title: "FAQ" };

export default function Page() {
  return <FaqContent />;
}

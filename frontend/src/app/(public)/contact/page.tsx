import type { Metadata } from "next";
import { ContactContent } from "@/features/legal/components/contact-content";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return <ContactContent />;
}

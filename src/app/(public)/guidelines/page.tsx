import type { Metadata } from "next";
import { GuidelinesContent } from "@/features/legal/components/guidelines-content";

export const metadata: Metadata = { title: "Community Guidelines" };

export default function Page() {
  return <GuidelinesContent />;
}

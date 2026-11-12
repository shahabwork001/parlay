import type { Metadata } from "next";
import { SafetyContent } from "@/features/legal/components/safety-content";

export const metadata: Metadata = { title: "Safety tips" };

export default function Page() {
  return <SafetyContent />;
}

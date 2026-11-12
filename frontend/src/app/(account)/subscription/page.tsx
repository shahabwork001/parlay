import type { Metadata } from "next";
import { PlusPreview } from "@/features/billing/components/plus-preview";
export const metadata: Metadata = { title: "Parley Plus preview" };
export default function Page() {
  return (
    <div className="px-4">
      <PlusPreview />
    </div>
  );
}

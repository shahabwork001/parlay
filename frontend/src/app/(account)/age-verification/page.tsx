import type { Metadata } from "next";
import { AgeVerification } from "@/features/account/components/age-verification";
export const metadata: Metadata = { title: "Age verification" };
export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Age verification</h1>
      <AgeVerification />
    </div>
  );
}

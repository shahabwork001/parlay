import Link from "next/link";
import { ThemeToggle } from "@/components/shared/theme-toggle";

/** Full-height chat shell: a slim header and nothing else competing for attention. */
export default function ChatLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between px-4">
          <Link href="/" className="rounded-sm text-[15px] font-semibold tracking-tight">
            Parley
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}

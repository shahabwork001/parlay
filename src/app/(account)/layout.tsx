import { SiteShell } from "@/components/shared/site-shell";

export default function AccountLayout({ children }: LayoutProps<"/">) {
  return <SiteShell>{children}</SiteShell>;
}

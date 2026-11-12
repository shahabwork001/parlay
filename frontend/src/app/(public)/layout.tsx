import { SiteShell } from "@/components/shared/site-shell";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <SiteShell>{children}</SiteShell>;
}

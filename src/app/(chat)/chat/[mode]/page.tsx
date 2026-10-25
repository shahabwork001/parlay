import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatScreen } from "@/features/chat/components/chat-screen";
import { CHAT_MODES, type ChatMode } from "@/lib/constants";

export const metadata: Metadata = { title: "Chat", robots: { index: false } };

export function generateStaticParams() {
  return CHAT_MODES.map((mode) => ({ mode }));
}

const isChatMode = (value: string): value is ChatMode =>
  (CHAT_MODES as readonly string[]).includes(value);

export default async function ChatPage({ params }: PageProps<"/chat/[mode]">) {
  const { mode } = await params;
  if (!isChatMode(mode)) notFound();
  return <ChatScreen mode={mode} />;
}

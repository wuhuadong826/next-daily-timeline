import type { Metadata, Viewport } from "next";
import "./globals.css";
import { requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "每日时间轴",
  description: "高精度规划，低压力执行。随时知道现在该做什么。",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#173f36", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireChatGPTUser("/");
  return <html lang="zh-CN"><body className="antialiased">{children}</body></html>;
}

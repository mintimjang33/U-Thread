import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "유쓰레드 — 쓰레드 콘텐츠 오케스트레이션",
  description: "AI 스마트 에디터로 쓰레드 콘텐츠를 자동화하고 트렌드를 분석하세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

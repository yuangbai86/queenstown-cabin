import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";
import { ToastProvider } from "@/components/Toast";
import { dataset } from "@/lib/data";

export const metadata: Metadata = {
  title: "PhoneLens 手机对比助手",
  description: "结合你的预算和使用偏好，用可核对的参数与评论证据，解释两款手机的差异与取舍。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main">
          跳到主要内容
        </a>
        <ToastProvider>
          <header className="site-header">
            <div className="inner">
              <Link className="brand" href="/">
                <span className="brand-mark" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round">
                    <circle cx="10.5" cy="10.5" r="6" />
                    <path d="M15 15l5 5" />
                  </svg>
                </span>
                PhoneLens
              </Link>
              <SiteNav />
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <footer className="site-footer">
            <div className="inner">
              <span>数据版本 {dataset.meta.data_version} · 整理日期 {dataset.meta.as_of}</span>
              <span>标有“演示数据”的机型、参数与评论为开发者编写的虚构内容，不代表任何真实产品。</span>
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}

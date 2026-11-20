import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteNav } from "@/components/SiteNav";
import { ToastProvider } from "@/components/Toast";
import { dataset } from "@/lib/data";

export const metadata: Metadata = {
  title: "PhoneLens · 两款手机，怎么选",
  description: "选好两款机型，看清与你有关的差异和取舍。每个判断都能查到参数与评论来源。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

const DEMO = dataset.phones.some((p) => p.data_kind === "demo");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main">
          跳到主要内容
        </a>
        <ToastProvider>
          <header className="nav">
            <div className="nav-inner">
              <Link className="wordmark" href="/">
                PhoneLens
              </Link>
              <SiteNav demo={DEMO} />
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            <div className="wrap">{children}</div>
          </main>
          <footer className="footer">
            <div className="footer-inner">
              <nav className="footer-links" aria-label="更多">
                <Link href="/import">导入自己的评论</Link>
                <Link href="/data">数据与方法</Link>
                <Link href="/data#demo">演示数据说明</Link>
              </nav>
              <p>
                数据版本 {dataset.meta.data_version} · 整理于 {dataset.meta.as_of}
                {DEMO ? " · 演示机型的参数、价格与评论均为虚构示例，不代表任何真实产品。" : ""}
              </p>
            </div>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** 导航只保留对比入口和一处演示标识；导入与数据说明在页脚 */
export function SiteNav({ demo }: { demo: boolean }) {
  const path = usePathname();
  return (
    <nav className="nav-links" aria-label="主导航">
      {demo && (
        <Link className="demo-pill" href="/data#demo" title="了解演示数据">
          演示模式 · 数据为虚构示例
        </Link>
      )}
      <Link className="hide-sm" href="/" aria-current={path === "/" || path.startsWith("/compare") ? "page" : undefined}>
        对比
      </Link>
      <Link className="hide-sm" href="/data" aria-current={path.startsWith("/data") ? "page" : undefined}>
        数据与方法
      </Link>
    </nav>
  );
}

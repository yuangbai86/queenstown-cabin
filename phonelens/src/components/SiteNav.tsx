"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "对比" },
  { href: "/import", label: "导入评论" },
  { href: "/data", label: "数据说明" },
];

export function SiteNav() {
  const path = usePathname();
  return (
    <nav className="site-nav" aria-label="主导航">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" || path.startsWith("/compare") : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

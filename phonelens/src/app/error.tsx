"use client";
import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="card empty-state" role="alert">
      <h1>页面加载出错</h1>
      <p>这次没有成功整理对比资料。你的选择已保存在本页会话中，可以重试或返回首页。</p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={reset}>
          重试
        </button>
        <Link className="btn" href="/">
          返回首页
        </Link>
      </div>
    </section>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <section className="card empty-state">
      <h1>页面不存在</h1>
      <p>这个地址没有对应的内容。可以回到首页重新选择要对比的手机。</p>
      <div className="actions">
        <Link className="btn btn-primary" href="/">
          返回首页
        </Link>
      </div>
    </section>
  );
}

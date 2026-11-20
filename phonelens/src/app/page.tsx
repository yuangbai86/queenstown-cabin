import Link from "next/link";
import { catalog, dataset } from "@/lib/data";
import { EXAMPLE, toSearch } from "@/lib/query";
import { CompareForm } from "@/components/CompareForm";
import { IconFlask } from "@/components/Icons";

export default function Home() {
  const items = catalog(dataset);
  const exampleHref = `/compare?${toSearch(EXAMPLE)}`;
  return (
    <>
      {/* 已访问过时跳过入场动画（在绘制前执行） */}
      <script
        dangerouslySetInnerHTML={{
          __html: "try{if(sessionStorage.getItem('pl:visited'))document.documentElement.classList.add('returning')}catch(e){}",
        }}
      />
      <section className="hero">
        <h1 className="enter enter-once" style={{ ["--i" as string]: 0 }}>
          两款手机怎么选，先看和你有关的差异
        </h1>
        <p className="enter enter-once" style={{ ["--i" as string]: 1 }}>
          选择两款候选机型，说说预算和最在意的方面。PhoneLens 会说明更值得考虑哪款、需要接受什么取舍，以及每个判断来自哪些参数和评论。
        </p>
      </section>

      <CompareForm catalog={items} />

      <section className="example-card card enter enter-once" style={{ ["--i" as string]: 3 }} aria-labelledby="example-title">
        <div className="text">
          <h2 id="example-title">
            先看一个示例
            <span className="badge badge-demo">
              <IconFlask /> 演示数据
            </span>
          </h2>
          <p className="muted small" style={{ marginTop: 4 }}>
            两款虚构机型 Alpha 与 Beta，预算 6000 元，首要“轻便手感”、其次“续航”。示例使用开发者编写的演示参数和评论，可直接打开，不需要调用付费服务。
          </p>
        </div>
        <Link className="btn" href={exampleHref}>
          打开示例对比
        </Link>
      </section>

      <section className="how-list" aria-label="工作方式">
        <div className="card">
          <h3>参数逐项标来源</h3>
          <p>每个参数显示来源与核验日期；没核验的写“尚未核验”，不会用推测补齐。</p>
        </div>
        <div className="card">
          <h3>评论按维度计数</h3>
          <p>续航、发热、影像等六个维度分开统计，数量和分母由程序计算，可点开看原文。</p>
        </div>
        <div className="card">
          <h3>证据不足就直说</h3>
          <p>样本太少或口径不同时，结果会写“证据不足”，不强行选出胜者。</p>
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { catalog, dataset } from "@/lib/data";
import { SALE_STATUS_LABEL } from "@/lib/labels";
import { DataKindBadge } from "@/components/Badges";
import { IconExternal } from "@/components/Icons";
import { MIN_SAMPLE, WINDOW_DAYS } from "@/lib/stats";
import { PRICE_GAP_THRESHOLD } from "@/lib/rules";

export const metadata: Metadata = { title: "数据与方法 · PhoneLens" };

const VERIFY: Record<string, string> = { fixture: "演示夹具", unverified: "尚未核验", human_verified: "已人工核验" };

export default function DataPage() {
  const items = catalog(dataset);
  return (
    <div className="stack">
      <div>
        <h1 className="page-title enter">数据与方法</h1>
        <p className="page-lead enter" style={{ ["--i" as string]: 1 }}>
          这里列出当前收录的机型、来源登记和比较规则。数据版本 {dataset.meta.data_version}，整理日期 {dataset.meta.as_of}。
        </p>
      </div>

      <section id="demo" className="panel enter" style={{ ["--i" as string]: 2 }} aria-labelledby="demo-h">
        <h2 id="demo-h" style={{ fontSize: 19, marginBottom: 8 }}>
          演示模式
        </h2>
        <p className="muted">
          Alpha、Beta、Gamma、Delta、Epsilon Pro 是虚构的演示机型，参数、价格与 84 条评论都由开发者编写，只用于展示比较、统计和证据流程，不代表任何真实产品。
          {" "}{dataset.meta.notes}
        </p>
      </section>

      <section id="method" className="panel" aria-labelledby="method-h">
        <h2 id="method-h" style={{ fontSize: 19, marginBottom: 8 }}>
          结论怎样得出
        </h2>
        <ul className="note-list" style={{ marginTop: 0, fontSize: 14.5 }}>
          <li>当前为基础模式：结论根据已记录的参数和样本统计按固定规则得出，没有调用模型。</li>
          <li>只有首要需求由已记录参数给出较明确差异、其次需求不反对时，才显示“更值得考虑”；只有评论倾向时最多显示“各有取舍”。</li>
          <li>没有选择需求时，只列出可核验的客观差异，不判断哪款更适合你。</li>
          <li>启用模型后，模型只改写解释；每个数字都要对应到具体机型、字段和单位，引用编号必须存在，不合格的句子会被删除。</li>
          <li>每个结论旁的“依据”和“来源”可以打开原始参数、价格、统计和评论。</li>
        </ul>
      </section>

      <section aria-labelledby="cat-h">
        <h2 id="cat-h" style={{ fontSize: 18, marginBottom: 10 }}>
          机型目录
        </h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">机型</th>
                <th scope="col">地区 / 存储</th>
                <th scope="col">类型</th>
                <th scope="col">销售状态</th>
                <th scope="col">数据</th>
                <th scope="col">说明</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <th scope="row">
                    {p.brand} {p.model}
                    <div className="ev-id">{p.id}</div>
                  </th>
                  <td>
                    {p.region} / {p.storage}
                  </td>
                  <td>
                    <DataKindBadge kind={p.data_kind} />
                  </td>
                  <td>{SALE_STATUS_LABEL[p.sale_status]}</td>
                  <td>
                    参数：{p.has_specs ? "有" : "尚未核验"}
                    <br />
                    评论：{p.review_count ? `${p.review_count} 条` : "未收录"}
                  </td>
                  <td className="small">{p.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="src-h">
        <h2 id="src-h" style={{ fontSize: 18, marginBottom: 10 }}>
          来源登记
        </h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">来源</th>
                <th scope="col">获取方式</th>
                <th scope="col">保存 / 展示范围</th>
                <th scope="col">核验</th>
                <th scope="col">备注</th>
              </tr>
            </thead>
            <tbody>
              {dataset.sources.map((s) => (
                <tr key={s.id}>
                  <th scope="row">
                    {s.url ? (
                      <a className="ext-link" href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                        {s.name}
                        <IconExternal />
                        <span className="sr-only">（外部网站）</span>
                      </a>
                    ) : (
                      s.name
                    )}
                    <div className="ev-id">{s.id}</div>
                  </th>
                  <td>{s.access_method}</td>
                  <td>
                    {s.allowed_storage}；展示：{s.allowed_display === "full_text" ? "全文" : s.allowed_display === "excerpt" ? "摘录" : s.allowed_display === "summary_only" ? "仅结构化摘要" : "不展示"}
                  </td>
                  <td>{VERIFY[s.verification]}</td>
                  <td className="small">{s.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="rule-h">
        <h2 id="rule-h" style={{ fontSize: 18, marginBottom: 10 }}>
          比较规则
        </h2>
        <ul className="note-list" style={{ marginTop: 0, fontSize: 14.5 }}>
          <li>参数、价格只展示已登记的记录；缺失时显示“官网未列出”或“尚未核验”，不用推测补齐。</li>
          <li>价格区分官方当前售价、官方建议零售价和用户填写价；口径不同或缺失时不生成价格优势结论。</li>
          <li>两款已知价格相差超过较低价的 {Math.round(PRICE_GAP_THRESHOLD * 100)}% 时提示“价差较大”。这是可调整的界面提示阈值。</li>
          <li>评论默认统计最近 {WINDOW_DAYS} 天的已收录样本，可切换到全部样本；{WINDOW_DAYS} 天是可调整的筛选规则，不是有效期。</li>
          <li>任一款已分析有效评论少于 {MIN_SAMPLE} 条、来源不同、筛选范围不同或时间范围重叠不足一半时，提示“样本口径不同”，不据提及情况比较优劣。</li>
          <li>口碑只在两组样本可比时使用，并对正面、负面占比分别做双比例检验（|z| ≥ 1.96）；即使差异明显也只算“评论倾向”，不能单独让结论变成“更值得考虑”。</li>
          <li>同一条评论在同一维度只计一次；明确负面与褒贬混合分开统计；待分析、待复核样本不进入分母。</li>
          <li>物流、客服、包装归入购物体验，不计入手机性能口碑。</li>
          <li>RAM、像素、芯片名称、电池容量按事实展示，不据此推出流畅度、成像或续航优劣。</li>
        </ul>
      </section>
    </div>
  );
}

"use client";
import { useEffect, useId, useState } from "react";
import type { CatalogItem } from "@/lib/data";
import { IMPORT_LIMITS, parseImportCsv, parsePasted, type ImportError } from "@/lib/csv";
import type { ImportResult } from "@/lib/import/service";
import { DIMENSIONS } from "@/lib/types";
import { DIMENSION_LABEL, SENTIMENT_LABEL, SENTIMENT_SYMBOL } from "@/lib/labels";
import { IconAlert, IconCheck, IconFlask, IconInfo } from "./Icons";

const CUSTOM = "__custom__";

export function ImportForm({ catalog, initialName }: { catalog: CatalogItem[]; initialName: string }) {
  const [phone, setPhone] = useState<string>(initialName ? CUSTOM : catalog[0]?.id ?? CUSTOM);
  const [outside, setOutside] = useState(initialName);
  const [format, setFormat] = useState<"paste" | "csv">("paste");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [consentErr, setConsentErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [aiStatus, setAiStatus] = useState<{ ai: boolean; fixture: boolean } | null>(null);
  const ids = { phone: useId(), outside: useId(), text: useId(), file: useId(), source: useId(), consent: useId(), err: useId() };

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setAiStatus({ ai: !!d.ai, fixture: !!d.fixture }))
      .catch(() => setAiStatus({ ai: false, fixture: false }));
  }, []);

  const phoneId = phone === CUSTOM ? "custom" : phone;

  const precheck = (): ImportError[] => {
    if (phone === CUSTOM && !outside.trim()) return [{ line: null, message: "请填写目录外机型的名称。" }];
    if (!content.trim()) return [{ line: null, message: format === "csv" ? "请选择 CSV 文件。" : "请粘贴至少一条评论。" }];
    const r = format === "csv" ? parseImportCsv(content, new Set([phoneId])) : parsePasted(content, phoneId, source);
    return r.errors;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const errs = precheck();
    setErrors(errs);
    setConsentErr(!consent);
    if (errs.length || !consent) {
      document.getElementById(errs.length ? ids.err : ids.consent)?.focus();
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          content,
          phone_id: phone === CUSTOM ? null : phone,
          outside_name: phone === CUSTOM ? outside.trim() : null,
          source_label: source.trim() || null,
          consent: true,
        }),
      });
      const data = await r.json();
      if (!r.ok) setErrors(data.errors ?? [{ line: null, message: "导入失败，请稍后重试。" }]);
      else setResult(data as ImportResult);
    } catch {
      setErrors([{ line: null, message: "网络错误，内容没有提交成功，可以直接重试。" }]);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    setErrors([]);
    if (!f) return;
    if (f.size > 40000) {
      setErrors([{ line: null, message: `文件有 ${Math.round(f.size / 1024)} KB，超过 40 KB，请分批导入。` }]);
      return;
    }
    setFileName(f.name);
    setContent(await f.text());
  };

  return (
    <div className="import-grid">
      <form className="card import-form" onSubmit={submit} noValidate aria-label="导入评论">
        <div className="form-section">
          <label className="legend" htmlFor={ids.phone}>
            评论对应的机型
          </label>
          <select id={ids.phone} className="input select" value={phone} onChange={(e) => setPhone(e.target.value)}>
            {catalog.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand} {p.model}（{p.storage}）{p.data_kind === "demo" ? " · 演示" : ""}
              </option>
            ))}
            <option value={CUSTOM}>目录外机型（只生成口碑摘要）</option>
          </select>
          {phone === CUSTOM && (
            <div style={{ marginTop: 10 }}>
              <label htmlFor={ids.outside} className="small muted">
                机型名称
              </label>
              <input id={ids.outside} className="input" maxLength={40} value={outside} onChange={(e) => setOutside(e.target.value)} placeholder="例如：某品牌 某型号 256GB" />
              <p className="field-hint">目录外机型没有已核验参数，只展示你提供的评论的口碑摘要，不生成完整选购建议。</p>
            </div>
          )}
        </div>

        <div className="form-section">
          <div className="legend">导入方式</div>
          <div className="window-switch" role="group" aria-label="导入方式">
            <button type="button" aria-pressed={format === "paste"} onClick={() => { setFormat("paste"); setContent(""); setFileName(null); setErrors([]); }}>
              粘贴文本
            </button>
            <button type="button" aria-pressed={format === "csv"} onClick={() => { setFormat("csv"); setContent(""); setErrors([]); }}>
              上传 CSV
            </button>
          </div>
          <div key={format} className="fade-swap" style={{ marginTop: 12 }}>
            {format === "paste" ? (
              <>
                <label htmlFor={ids.text} className="small muted">
                  每行一条评论
                </label>
                <textarea id={ids.text} className="input" value={content} onChange={(e) => setContent(e.target.value)} placeholder={"拍照很好，但玩游戏容易热。\n续航一般，下午需要充电。"} />
                <label htmlFor={ids.source} className="small muted" style={{ display: "block", marginTop: 10 }}>
                  来源说明（选填）
                </label>
                <input id={ids.source} className="input" maxLength={60} value={source} onChange={(e) => setSource(e.target.value)} placeholder="例如：我自己的使用记录" />
              </>
            ) : (
              <>
                <label htmlFor={ids.file} className="small muted">
                  CSV 文件（UTF-8）
                </label>
                <input id={ids.file} className="input" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
                <p className="field-hint">
                  必填列 phone_id、text、source_label；可选 review_id、review_date、system_version、source_url。phone_id 需填
                  <code className="mono"> {phoneId} </code>。
                  <a href="/templates/reviews_template.csv" download>
                    下载模板
                  </a>
                  {fileName ? ` · 已读取 ${fileName}` : ""}
                </p>
              </>
            )}
          </div>
          <p className="field-hint">
            单次最多 {IMPORT_LIMITS.maxRows} 条、每条最多 {IMPORT_LIMITS.maxChars} 字符、合计最多 {IMPORT_LIMITS.maxTotal} 字符。超出时会提示，不会悄悄截断。
          </p>
        </div>

        <div id={ids.err} tabIndex={-1} aria-live="polite">
          {errors.length > 0 && (
            <div className="notice notice-error" role="alert">
              <IconAlert className="icon" />
              <div>
                <strong>需要修改后再提交：</strong>
                <ul className="error-list">
                  {errors.slice(0, 12).map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                  {errors.length > 12 && <li>另有 {errors.length - 12} 处问题。</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="form-section">
          <label className="check-pill" style={{ alignItems: "flex-start" }}>
            <input id={ids.consent} type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setConsentErr(false); }} aria-describedby={`${ids.consent}-msg`} />
            <span className="box" aria-hidden="true" style={{ marginTop: 4 }}>
              <IconCheck size={11} />
            </span>
            <span>我确认有权提交这些文本，并知道它们会发送给已配置的模型服务做维度分析。</span>
          </label>
          <div id={`${ids.consent}-msg`}>
            {consentErr && (
              <p className="field-error">
                <IconAlert /> 请先勾选确认，再提交。
              </p>
            )}
          </div>
        </div>

        <div className="submit-row">
          <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>
            <span className="btn-stack">
              <span style={{ visibility: busy ? "hidden" : "visible" }}>分析这些评论</span>
              <span style={{ visibility: busy ? "visible" : "hidden" }} aria-hidden={!busy}>
                <span className="spinner" aria-hidden="true" /> 正在清洗与分析
              </span>
            </span>
          </button>
        </div>
      </form>

      <aside className="stack">
        <div className="card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}>
            <IconInfo /> 你的文本会怎样处理
          </h2>
          <ul className="note-list" style={{ marginTop: 0 }}>
            <li>先在服务端去重、识别广告与机型混入，再把通过清洗的文本发送给已配置的模型服务，按六个固定维度提取标签。</li>
            <li>只用于本次分析：不写入公共目录，不进入公共缓存，应用日志不保存原文。</li>
            <li>导入样本与内置样本分开统计，不混在一起计算比例。</li>
            <li>没有日期或链接的样本标为“用户提供，来源未独立核验”。评论里的链接不会被打开。</li>
            <li>模型服务商自身的数据保留规则需要以其公开政策为准。</li>
          </ul>
          <p className="small" style={{ marginTop: 10 }}>
            当前状态：
            {aiStatus === null
              ? "检查中…"
              : aiStatus.ai
                ? aiStatus.fixture
                  ? "本地测试夹具（不是真实模型）"
                  : "模型分析可用"
                : "未配置模型服务，只做清洗与去重，维度分析不会进行"}
          </p>
        </div>
      </aside>

      {result && (
        <section className="card enter" style={{ gridColumn: "1 / -1", padding: 20 }} aria-labelledby="import-result-h">
          <div className="section-title" style={{ marginBottom: 10 }}>
            <h2 id="import-result-h" style={{ fontSize: 18 }}>
              {result.phone.name} · 导入样本摘要
            </h2>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="badge badge-outline">用户提供，来源未独立核验</span>
              {result.mode === "ai" ? (
                result.fixture ? (
                  <span className="badge badge-demo">
                    <IconFlask /> 测试夹具标注（非模型）
                  </span>
                ) : (
                  <span className="badge badge-blue">本次 AI 分析 · 摘录已校验</span>
                )
              ) : (
                <span className="badge">仅清洗，未做维度分析</span>
              )}
            </span>
          </div>
          {result.message && (
            <p className="notice notice-info" style={{ marginBottom: 12 }}>
              <IconInfo className="icon" /> {result.message}
            </p>
          )}
          {!result.phone.in_catalog && (
            <p className="notice notice-warn" style={{ marginBottom: 12 }}>
              <IconAlert className="icon" /> 目录外机型：没有已核验参数，这里只汇总你提供的评论，不生成完整选购建议。
            </p>
          )}
          <dl className="kv" style={{ marginBottom: 14 }}>
            <dt>提交</dt>
            <dd>{result.stats.n_total} 条</dd>
            <dt>清洗排除</dt>
            <dd>{result.stats.n_excluded} 条</dd>
            <dt>待复核 / 未分析</dt>
            <dd>
              {result.stats.n_flagged + result.stats.n_needs_review} / {result.stats.n_pending} 条
            </dd>
            <dt>已分析有效（N）</dt>
            <dd>
              <strong>{result.stats.n} 条</strong>
            </dd>
          </dl>
          {result.stats.n > 0 && (
            <div className="table-scroll">
              <table className="data-table">
                <caption className="sr-only">各维度提及数量（分母为已分析有效评论）</caption>
                <thead>
                  <tr>
                    <th scope="col">维度</th>
                    <th scope="col">提及 / N</th>
                    <th scope="col">{SENTIMENT_SYMBOL.pos} 正面</th>
                    <th scope="col">{SENTIMENT_SYMBOL.neg} 负面</th>
                    <th scope="col">{SENTIMENT_SYMBOL.mixed} 褒贬混合</th>
                    <th scope="col">{SENTIMENT_SYMBOL.neu} 中性</th>
                  </tr>
                </thead>
                <tbody>
                  {DIMENSIONS.map((d) => {
                    const x = result.stats.dims[d];
                    return (
                      <tr key={d}>
                        <th scope="row">{DIMENSION_LABEL[d]}</th>
                        <td>
                          {x.mentions} / {result.stats.n}
                        </td>
                        <td>{x.pos}</td>
                        <td>{x.neg}</td>
                        <td>{x.mixed}</td>
                        <td>{x.neu}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <h3 style={{ fontSize: 15, margin: "18px 0 8px" }}>逐条结果</h3>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">行</th>
                  <th scope="col">评论</th>
                  <th scope="col">状态</th>
                  <th scope="col">标签</th>
                </tr>
              </thead>
              <tbody>
                {result.reviews.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.line}</td>
                    <td style={{ minWidth: 220 }}>{r.text}</td>
                    <td style={{ minWidth: 120 }}>{r.status}</td>
                    <td>{r.labels.length ? r.labels.map((l) => `${l.dimension}·${l.sentiment}`).join("、") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            页面关闭后这些结果不会保留。{SENTIMENT_LABEL.mixed}与明确负面分开统计。
          </p>
        </section>
      )}
    </div>
  );
}

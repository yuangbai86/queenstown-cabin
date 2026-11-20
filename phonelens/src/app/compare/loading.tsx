/** 与结果页布局对应的骨架屏；只显示真实阶段，不显示进度百分比 */
export default function Loading() {
  return (
    <div className="skeleton-wrap" aria-busy="true">
      <p className="stage-line" role="status">
        <span className="spinner" aria-hidden="true" /> 正在整理对比资料：读取参数记录、价格口径和评论统计
      </p>
      <div className="result-head">
        <div style={{ width: "min(420px, 80%)" }}>
          <div className="skeleton skel-title" style={{ width: "100%" }} />
          <div className="skeleton skel-line" style={{ marginTop: 10, width: "80%" }} />
          <div className="skeleton skel-line" style={{ marginTop: 6, width: "70%" }} />
        </div>
        <div className="skeleton" style={{ width: 200, height: 36 }} />
      </div>
      <div className="skeleton" style={{ height: 56, marginBottom: 18 }} />
      <div className="card rec-card">
        <div className="skeleton" style={{ width: 160, height: 34, borderRadius: 999 }} />
        <div className="skeleton skel-line" style={{ marginTop: 18, width: "92%", height: 18 }} />
        <div className="skeleton skel-line" style={{ marginTop: 10, width: "86%" }} />
        <div className="skeleton skel-line" style={{ marginTop: 10, width: "74%" }} />
        <div className="rec-cols">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 96 }} />
          ))}
        </div>
      </div>
      <div className="verdict-grid" style={{ marginTop: 26 }}>
        {[0, 1].map((i) => (
          <div key={i} className="card verdict">
            <div className="skeleton skel-line" style={{ width: "40%", height: 18 }} />
            <div className="skeleton skel-line" style={{ marginTop: 14 }} />
            <div className="skeleton skel-line" style={{ marginTop: 8, width: "80%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

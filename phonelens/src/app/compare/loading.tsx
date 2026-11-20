/** 与新结果页布局对应的骨架屏；只显示真实阶段，不显示进度百分比 */
export default function Loading() {
  return (
    <div className="skeleton-wrap" aria-busy="true">
      <p className="stage-line" role="status">
        <span className="spinner" aria-hidden="true" /> 正在整理两款手机的参数与样本
      </p>
      <div className="product-head" style={{ paddingTop: 24 }}>
        {[0, 1].map((i) => (
          <div key={i} className="product">
            <div className="device skeleton" style={{ borderRadius: 18 }} />
            <div className="skeleton" style={{ width: 120, height: 26, marginTop: 16 }} />
            <div className="skeleton" style={{ width: 140, height: 14, marginTop: 8 }} />
          </div>
        ))}
      </div>
      <div className="verdict" style={{ paddingTop: 64 }}>
        <div className="skeleton" style={{ width: 200, height: 32, margin: "0 auto 26px" }} />
        <div className="skeleton" style={{ width: "70%", height: 28, margin: "0 auto" }} />
        <div className="skeleton" style={{ width: "45%", height: 16, margin: "22px auto 0" }} />
        <div className="skeleton" style={{ width: "40%", height: 16, margin: "10px auto 0" }} />
      </div>
    </div>
  );
}

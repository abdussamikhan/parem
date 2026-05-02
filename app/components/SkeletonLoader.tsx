'use client';
/**
 * app/components/SkeletonLoader.tsx
 * Shimmer skeleton cards — shown while data is loading.
 */

export function KpiSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="sk-strip" style={{ gridTemplateColumns: `repeat(${count},1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="sk-kpi">
          <div className="sk-block sk-kpi-text">
            <div className="sk-line sk-w60" />
            <div className="sk-line sk-w40 sk-tall" />
          </div>
          <div className="sk-icon-ph shimmer" />
        </div>
      ))}
      <style>{`
        .sk-strip{display:grid;gap:.875rem}
        .sk-kpi{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.125rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:14px}
        .sk-kpi-text{display:flex;flex-direction:column;gap:.5rem}
        .sk-block{display:flex;flex-direction:column;gap:.375rem}
        .sk-line{background:rgba(255,255,255,.07);border-radius:6px;height:11px}
        .sk-w60{width:60px}.sk-w40{width:40px}
        .sk-tall{height:22px;width:50px}
        .sk-icon-ph{width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,.06)}
        .shimmer{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.1) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite}
        @keyframes shimmer{to{background-position:-200% 0}}
      `}</style>
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="csk-panel">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="csk-row shimmer">
          <div className="csk-avatar shimmer" />
          <div className="csk-lines">
            <div className="csk-line csk-l1 shimmer" />
            <div className="csk-line csk-l2 shimmer" />
          </div>
        </div>
      ))}
      <style>{`
        .csk-panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:18px;padding:1.5rem;display:flex;flex-direction:column;gap:.75rem}
        .csk-row{display:flex;align-items:center;gap:.75rem;padding:.625rem;border-radius:10px}
        .csk-avatar{width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.07);flex-shrink:0}
        .csk-lines{flex:1;display:flex;flex-direction:column;gap:.375rem}
        .csk-line{background:rgba(255,255,255,.07);border-radius:6px}
        .csk-l1{height:12px;width:55%}
        .csk-l2{height:10px;width:35%}
        .shimmer{background:linear-gradient(90deg,rgba(255,255,255,.04) 25%,rgba(255,255,255,.1) 50%,rgba(255,255,255,.04) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite}
        @keyframes shimmer{to{background-position:-200% 0}}
      `}</style>
    </div>
  );
}

import { notFound } from 'next/navigation';

// 兜底 catch-all:[locale] 下任何未匹配路径(如 /en/zzz)进这里 → notFound()
// → 渲染 [locale]/not-found.tsx(被 [locale]/layout 的 SiteShell 包裹,带 header 可导航)。
// 具体路由(/app /history /result/[id] 等)优先级更高,不受影响。
export default function CatchAllNotFound() {
  notFound();
}

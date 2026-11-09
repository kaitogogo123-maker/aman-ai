// AMAN AI 品牌 logo(设计师提供素材,透明底)。height 控制头部显示高度,宽度按比例自适应。
// 用普通 <img> 指向静态资源(非 next/image 的 /_next/image 动态优化端点):
// 静态资源被浏览器缓存,切换页面 header 重新挂载时即时渲染,避免 logo 闪烁。
export function AmanLogo({ height = 44 }: { height?: number }) {
  const width = Math.round((789 / 479) * height);
  return (
    <img
      src="/aman-ai-logo.webp"
      alt="AMAN AI"
      width={width}
      height={height}
      decoding="sync"
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}

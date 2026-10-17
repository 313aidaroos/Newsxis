/** Official Newsxis mark from /brand/mark.png (1224×881). */
const MARK_WIDTH = 1224;
const MARK_HEIGHT = 881;

export function BrandMark({ height = 36 }: { height?: number }) {
  const width = Math.round((height * MARK_WIDTH) / MARK_HEIGHT);
  return <img src="/brand/mark.png" alt="" width={width} height={height} className="nx-brand-mark" />;
}

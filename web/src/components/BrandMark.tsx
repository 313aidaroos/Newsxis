/** Official Newsxis mark. File lives only in public/brand. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return <img src="/brand/mark.png" alt="" width={size} height={size} className="nx-brand-mark" />;
}

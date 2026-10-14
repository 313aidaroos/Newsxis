import { mediaPresentation } from "@/lib/safety";

type Kind = "image" | "video" | "audio" | string;

/** Renders one media file. Graphic files stay hidden until the reader opts in, then blurred until hover. */
export function GraphicMedia({ url, kind, graphic, showGraphic }: { url: string; kind: Kind; graphic: boolean; showGraphic: boolean }) {
  const mode = mediaPresentation(graphic, showGraphic);
  if (mode === "hide") {
    return <p className="nx-tiny" style={{ margin: 0 }}>Graphic media is off. Signed-in readers can turn it on in settings. It stays blurred until you hover.</p>;
  }
  const className = mode === "blur" ? "nx-blur" : "";
  if (kind === "video") return <video src={url} controls className={className} style={{ width: "100%", borderRadius: 12 }} />;
  if (kind === "audio") return <audio src={url} controls style={{ width: "100%" }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={className} style={{ width: "100%", borderRadius: 12 }} />;
}

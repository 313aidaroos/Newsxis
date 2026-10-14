import { facebookPageEmbeds, facebookPageUrl } from "@/lib/public-site";

/** Link, and a Page embed when Facebook can render that URL. profile.php stays a clean link. */
export function FacebookPage({ url = facebookPageUrl() }: { url?: string | null }) {
  if (!url) {
    return (
      <section className="nx-card" id="facebook">
        <h3>Facebook</h3>
        <p className="nx-muted">The Newsxis Facebook Page is not linked yet. The address is added in site configuration when it is ready. Nothing is shown in its place.</p>
      </section>
    );
  }
  const plugin = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(url)}&tabs=timeline&width=340&height=420&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`;
  return (
    <section className="nx-card" id="facebook">
      <h3>Facebook</h3>
      <p><a href={url} target="_blank" rel="noreferrer">Newsxis on Facebook</a></p>
      <p className="nx-muted"><a href={url} target="_blank" rel="noreferrer">{url}</a></p>
      {facebookPageEmbeds(url) ? (
        <iframe title="Newsxis on Facebook" src={plugin} width={340} height={420} style={{ border: 0, overflow: "hidden", maxWidth: "100%", marginTop: 10 }} scrolling="no" allow="encrypted-media" sandbox="allow-scripts allow-same-origin allow-popups" />
      ) : null}
    </section>
  );
}

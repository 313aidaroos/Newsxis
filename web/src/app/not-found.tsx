import Link from "next/link";

export default function NotFound() {
  return (
    <div className="nx-page nx-page-narrow">
      <p className="nx-tiny">404</p>
      <h1 className="nx-h1">This page is not on the map</h1>
      <p className="nx-sub">That address does not match a story or a page. Nothing was added to fill the gap.</p>
      <Link className="nx-btn" href="/">Back to the globe</Link>
    </div>
  );
}

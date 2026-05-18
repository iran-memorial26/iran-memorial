/** RSS 2.0 feed of newly documented victims.
 *  Includes Media RSS namespace so feed readers can render the photo thumbnail. */
import {
  BASE_URL,
  buildDescription,
  itemTitle,
  itemUrl,
  loadFeedItems,
  xmlEscape,
  type FeedItem,
} from "@/lib/feed";

export const revalidate = 3600;

export async function GET() {
  let items: FeedItem[] = [];
  try {
    items = await loadFeedItems();
  } catch {
    items = [];
  }

  const buildDate = new Date().toUTCString();
  const lastBuild = items[0]?.createdAt?.toUTCString() ?? buildDate;

  const itemXml = items
    .map((it) => {
      const url = itemUrl(it.slug);
      const title = xmlEscape(itemTitle(it));
      const desc = xmlEscape(buildDescription(it));
      const pubDate = it.createdAt.toUTCString();
      const photo = it.photoUrl
        ? `\n      <media:content url="${xmlEscape(it.photoUrl)}" medium="image" />\n      <enclosure url="${xmlEscape(it.photoUrl)}" type="image/jpeg" length="0" />`
        : "";
      return `    <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${desc}</description>${photo}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:media="http://search.yahoo.com/mrss/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Iran Memorial — Newly documented victims</title>
    <link>${BASE_URL}</link>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Latest victim profiles added to the Iran Memorial database — a digital memorial for victims of the Islamic Republic of Iran (1979–present). Verified entries are marked accordingly.</description>
    <language>en</language>
    <copyright>CC BY-SA 4.0 — Iran Memorial</copyright>
    <lastBuildDate>${lastBuild}</lastBuildDate>
    <pubDate>${buildDate}</pubDate>
    <ttl>60</ttl>
    <generator>Iran Memorial RSS Builder</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
${itemXml}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}

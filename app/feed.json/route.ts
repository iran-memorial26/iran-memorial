/** JSON Feed 1.1 — modern alternative to RSS, easier for tooling.
 *  https://jsonfeed.org/version/1.1 */
import {
  BASE_URL,
  buildDescription,
  itemTitle,
  itemUrl,
  loadFeedItems,
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

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "Iran Memorial — Newly documented victims",
    home_page_url: BASE_URL,
    feed_url: `${BASE_URL}/feed.json`,
    description:
      "Latest victim profiles added to the Iran Memorial database — a digital memorial for victims of the Islamic Republic of Iran (1979–present).",
    language: "en",
    icon: `${BASE_URL}/favicon.ico`,
    items: items.map((it) => {
      const url = itemUrl(it.slug);
      return {
        id: url,
        url,
        title: itemTitle(it),
        content_text: buildDescription(it),
        date_published: it.createdAt.toISOString(),
        date_modified: it.updatedAt.toISOString(),
        ...(it.photoUrl ? { image: it.photoUrl } : {}),
        tags: [
          it.verificationStatus === "verified" ? "verified" : "unverified",
          ...(it.causeOfDeath ? [it.causeOfDeath] : []),
        ],
      };
    }),
  };

  return Response.json(feed, {
    headers: {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}

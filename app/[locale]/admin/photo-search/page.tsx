import { setRequestLocale } from "next-intl/server";
import { PhotoSearchClient } from "./PhotoSearchClient";

export const dynamic = "force-dynamic";

export default async function PhotoSearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-memorial-100">Reverse Photo Search</h1>
        <p className="text-sm text-memorial-400 mt-2 max-w-2xl">
          Upload an image or paste a victim photo id to find visually similar photos already in
          the memorial. Uses a 64-bit perceptual hash (Hamming distance &le; 8 by default).
          Useful for verifying new submissions and discovering additional photos of the same
          person.
        </p>
      </header>
      <PhotoSearchClient />
    </div>
  );
}

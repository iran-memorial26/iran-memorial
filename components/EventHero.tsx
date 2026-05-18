import Image from "next/image";

type EventHeroProps = {
  title: string;
  photoUrl?: string | null;
  children: React.ReactNode;
};

export function EventHero({ title, photoUrl, children }: EventHeroProps) {
  if (!photoUrl) {
    return (
      <section className="relative py-16 sm:py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-memorial-950 via-memorial-900/30 to-memorial-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-blood-600)_0%,_transparent_70%)] opacity-[0.04]" />
        <div className="relative mx-auto max-w-4xl">
          {children}
        </div>
      </section>
    );
  }

  return (
    <section className="relative py-16 sm:py-20 px-4 overflow-hidden">
      <Image
        src={photoUrl}
        alt={title}
        fill
        sizes="100vw"
        className="object-cover"
        unoptimized={photoUrl.startsWith("https://")}
      />
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative mx-auto max-w-4xl">
        {children}
      </div>
    </section>
  );
}

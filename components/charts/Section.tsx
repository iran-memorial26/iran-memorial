export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-12 sm:mt-16 first:mt-0">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-lg font-semibold text-gold-400 flex-shrink-0">
          {title}
        </h2>
        <div className="h-px flex-1 bg-memorial-800" />
      </div>
      {children}
    </div>
  );
}

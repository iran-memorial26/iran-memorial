"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import "leaflet/dist/leaflet.css";
import type { Locale } from "@/i18n/config";

type ProvinceMapData = {
  slug: string;
  name: string;
  latitude: number;
  longitude: number;
  count: number;
};

export function IranMap({
  data,
  locale,
}: {
  data: ProvinceMapData[];
  locale: Locale;
}) {
  const t = useTranslations("map");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-[500px] bg-memorial-900/50 rounded-lg border border-memorial-800/60 flex items-center justify-center">
        <p className="text-memorial-500">{t("loadingMap")}</p>
      </div>
    );
  }

  return <MapInner data={data} locale={locale} />;
}

function MapInner({ data, locale }: { data: ProvinceMapData[]; locale: Locale }) {
  const t = useTranslations("map");
  const router = useRouter();
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [CircleMarker, setCircleMarker] = useState<any>(null);
  const [Tooltip, setTooltip] = useState<any>(null);

  useEffect(() => {
    // Dynamic import to avoid SSR issues
    Promise.all([
      import("leaflet"),
      import("react-leaflet"),
    ]).then(([, rl]) => {
      setMapContainer(() => rl.MapContainer);
      setTileLayer(() => rl.TileLayer);
      setCircleMarker(() => rl.CircleMarker);
      setTooltip(() => rl.Tooltip);
    });

  }, []);

  if (!MapContainer) {
    return (
      <div className="w-full h-[500px] bg-memorial-900/50 rounded-lg border border-memorial-800/60 flex items-center justify-center">
        <p className="text-memorial-500">{t("loadingMap")}</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const getRadius = (count: number) => {
    const ratio = count / maxCount;
    return 8 + ratio * 30;
  };

  const getColor = (count: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.5) return "#dc2626"; // blood red
    if (ratio > 0.2) return "#ea580c"; // orange-red
    return "#d97706"; // amber
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-memorial-800/60" style={{ height: "500px" }}>
    <MapContainer
      center={[32.4279, 53.6880] as [number, number]}
      zoom={5}
      style={{ width: "100%", height: "100%" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {data.map((item) => (
        <CircleMarker
          key={item.slug}
          center={[item.latitude, item.longitude] as [number, number]}
          radius={getRadius(item.count)}
          pathOptions={{
            fillColor: getColor(item.count),
            fillOpacity: 0.6,
            color: getColor(item.count),
            weight: 1,
            opacity: 0.8,
            // Visual cursor hint that markers are clickable.
            className: "iran-map-marker",
          }}
          eventHandlers={{
            // Click on a province marker → filtered /victims grid. Map
            // becomes an entry surface rather than a dead-end visualization.
            click: () => router.push(`/victims?province=${encodeURIComponent(item.slug)}`),
          }}
        >
          <Tooltip>
            <strong>{item.name}</strong>
            <br />
            {item.count.toLocaleString(locale === "fa" ? "fa-IR" : locale === "de" ? "de-DE" : "en-US")} {t("victims")}
            <br />
            <em style={{ opacity: 0.7, fontSize: "0.85em" }}>
              {locale === "de"
                ? "Klicken zum Filtern"
                : locale === "fa"
                ? "برای فیلتر کلیک کنید"
                : "Click to filter"}
            </em>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
    </div>
  );
}

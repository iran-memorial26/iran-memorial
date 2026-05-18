"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations();

  const navItems = [
    { href: "/admin", label: "Submissions" },
    { href: "/admin/api-keys", label: "API Keys" },
    { href: "/admin/partners", label: t("admin.partners") },
    { href: "/admin/photo-search", label: "Photo Search" },
  ];

  return (
    <nav className="border-b border-memorial-800 bg-memorial-900 mb-8">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-3 text-sm border-b-2 transition-colors ${
                pathname === item.href
                  ? "border-gold-500 text-gold-400"
                  : "border-transparent text-memorial-300 hover:text-memorial-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

import { AdminNav } from "@/components/AdminNav";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-memorial-950 text-memorial-100">
      <AdminNav />
      {children}
    </div>
  );
}

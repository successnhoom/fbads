"use client";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorBox, Loading, PageHeader } from "@/components/ui/misc";
import { Markdown } from "@/components/markdown";
import { useFetch } from "@/lib/client";
import type { Report } from "@prisma/client";

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, loading } = useFetch<Report>(`/api/reports/${id}`);
  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;
  return (
    <div className="max-w-4xl">
      <PageHeader title={data.title} description={`สร้างเมื่อ ${new Date(data.createdAt).toLocaleString("th-TH")}`}>
        <Button variant="outline" size="sm" asChild><Link href="/reports"><ArrowLeft /> กลับ</Link></Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> พิมพ์ / PDF</Button>
      </PageHeader>
      <Card>
        <CardContent className="p-6">
          <Markdown>{data.markdown}</Markdown>
        </CardContent>
      </Card>
    </div>
  );
}

import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOperatorPage } from "@/features/auth/server/staff-session";
import { ScoreConsole } from "@/features/matches/components/score-console";
import { getMatchState } from "@/features/matches/server/match-queries";
import styles from "@/features/operators/components/workspace.module.css";

export const metadata: Metadata = {
  title: "Score entry",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function OperatorMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await requireOperatorPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const state = await getMatchState(id, { id: staff.id, role: staff.role });
  if (!state) notFound();

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/operator" className={styles.brand}>
          <Image
            src="/brand/ndcak-mark.webp"
            alt=""
            width={160}
            height={71}
            priority
          />
          NDCAK <small>OPERATOR</small>
        </Link>
        <Link href="/operator" className={styles.headerLink}>
          <ArrowLeft size={16} aria-hidden="true" /> My matches
        </Link>
      </header>
      <div className={styles.scoreContent}>
        <ScoreConsole initial={state} actorId={staff.id} />
      </div>
    </main>
  );
}

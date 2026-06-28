"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function PasswordExpiryBanner() {
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/session-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.passwordExpiringSoon && typeof d.passwordExpiresInDays === "number") {
          setDaysLeft(d.passwordExpiresInDays);
        }
      })
      .catch(() => undefined);
  }, []);

  if (daysLeft === null) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-200">
      Sua senha expira em <strong>{daysLeft} dia(s)</strong>.{" "}
      <Link href="/account/password" className="underline hover:text-amber-100">
        Altere agora
      </Link>
    </div>
  );
}

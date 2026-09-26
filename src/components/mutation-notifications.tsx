"use client";

import { useEffect, useState } from "react";

export const mutationNoticeEvent = "isev:mutation-notice";

export function notifyMutation(kind: "success" | "error", message: string) {
  window.dispatchEvent(
    new CustomEvent(mutationNoticeEvent, { detail: { kind, message } }),
  );
}

export function MutationNotifications() {
  const [notice, setNotice] = useState<{
    kind: string;
    message: string;
  } | null>(null);
  useEffect(() => {
    const listener = (event: Event) => {
      setNotice((event as CustomEvent).detail);
      window.setTimeout(() => setNotice(null), 4500);
    };
    window.addEventListener(mutationNoticeEvent, listener);
    return () => window.removeEventListener(mutationNoticeEvent, listener);
  }, []);
  if (!notice) return null;
  return (
    <div
      className={`mutation-toast ${notice.kind}`}
      role={notice.kind === "error" ? "alert" : "status"}
    >
      {notice.message}
    </div>
  );
}

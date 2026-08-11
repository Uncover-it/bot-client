"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { openDm } from "@/api/data/actions";
import { useRealtimeStore } from "@/lib/store";
import type { Channel, User } from "@/lib/discord/types";

/**
 * Opens a DM with a user and navigates to it. Discord returns the existing
 * channel when one is already open, so this is safe to call repeatedly.
 */
export function useOpenDm() {
  const router = useRouter();
  const upsertDm = useRealtimeStore((s) => s.upsertDm);
  const dms = useRealtimeStore((s) => s.dms);

  return useCallback(
    async (user: Pick<User, "id"> & Partial<User>) => {
      // Already known: navigate immediately, no round trip.
      const known = Array.from(dms.values()).find((c) =>
        c.recipients?.some((r) => r.id === user.id),
      );
      if (known) {
        router.push(`/dashboard/dms/${known.id}`);
        return known;
      }
      try {
        const channel: Channel = await openDm(user.id);
        if (!channel?.id) throw new Error("Discord returned no channel");
        upsertDm(channel);
        router.push(`/dashboard/dms/${channel.id}`);
        return channel;
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not open a DM with this user",
        );
        return null;
      }
    },
    [router, upsertDm, dms],
  );
}

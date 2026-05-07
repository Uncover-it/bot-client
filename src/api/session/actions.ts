"use server";

import { cookies } from "next/headers";
import { API_BASE } from "@/lib/discord/constants";
import type { User } from "@/lib/discord/types";

export async function getSessionToken(): Promise<string | null> {
  const c = await cookies();
  return c.get("token")?.value ?? null;
}

export async function getCurrentUser(): Promise<User | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/users/@me`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

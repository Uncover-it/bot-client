"use server";

import { cookies } from "next/headers";
import { checkBotId } from "botid/server";
import { API_BASE } from "@/lib/discord/constants";

export async function validateToken(token: string) {
  const v = await checkBotId();
  if (v.isBot) throw new Error("Bot detected");
  const res = await fetch(`${API_BASE}/users/@me`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (res.ok && data?.id) {
    const c = await cookies();
    c.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return data;
}

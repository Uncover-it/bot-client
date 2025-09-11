"use server";
import { cookies } from "next/headers";

export async function validateToken(token: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {
      Authorization: `Bot ${token}`,
    },
  });
  if (response.status === 200) {
    const cookieStore = await cookies();
    cookieStore.set("token", `${token}`);
  }
  return response.json();
}

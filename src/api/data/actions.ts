"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("token");
  redirect("/");
}

export async function getBotInfo() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {
      Authorization: `Bot ${token}`,
    },
    next: {
      revalidate: 120,
    },
  });
  return response.json();
}

export async function getServers() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: {
      Authorization: `Bot ${token}`,
    },
    next: {
      revalidate: 120,
    },
  });
  return response.json();
}

export async function updateBotInfo(username: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const response = await fetch("https://discord.com/api/users/@me", {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ username: username }),
  });
  return response.json();
}

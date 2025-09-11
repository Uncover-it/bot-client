"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("token")
  redirect("/")
}

export async function getInfo() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {
      Authorization: `Bot ${token}`,
    },
  });
  return response.json();
}

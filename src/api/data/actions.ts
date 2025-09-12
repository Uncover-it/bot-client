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
  interface ServerProps {
    id: number;
    name: string;
    icon: string | null;
    features: string[];
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const guildsResponse = await fetch(
    "https://discord.com/api/v10/users/@me/guilds",
    {
      headers: {
        Authorization: `Bot ${token}`,
      },
      next: {
        revalidate: 120,
      },
    }
  );
  const guilds = await guildsResponse.json();
  const guildsWithChannels = await Promise.all(
    guilds.map(async (guild: ServerProps) => {
      const channelsResponse = await fetch(
        `https://discord.com/api/v10/guilds/${guild.id}/channels`,
        {
          headers: {
            Authorization: `Bot ${token}`,
          },
          next: {
            revalidate: 120,
          },
        }
      );

      let channels = [];
      if (channelsResponse.ok) {
        channels = await channelsResponse.json();
      } else {
        console.error(`Failed to fetch channels for guild ${guild.id}`);
      }
      return { ...guild, channels };
    })
  );

  return guildsWithChannels;
}

export async function updateBotInfo(username: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const response = await fetch("https://discord.com/api/users/@me", {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username: username }),
  });
  return response.json();
}

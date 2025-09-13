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

export async function getInviteCode(id: number | undefined) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const response = await fetch(
    `https://discord.com/api/v10/channels/${id}/invites`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
      },
      cache: "force-cache",
    }
  );
  const data = await response.json();
  return data.code;
}

export async function sendMessage(
  id: string,
  tts: boolean,
  text?: string,
  files?: (File | { name?: string; type?: string; data?: ArrayBuffer })[]
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!files || files.length === 0) {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: text, tts }),
      }
    );
    return response.json();
  }

  const form = new FormData();

  const payload = { content: text || "", tts };
  form.append("payload_json", JSON.stringify(payload));

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (typeof (f as File)?.stream === "function" || f instanceof Blob) {
      form.append(`files[${i}]`, f as File, (f as File).name || `file-${i}`);
    } else if (f && "data" in f && f.data) {
      const blob = new Blob([f.data], {
        type: f.type || "application/octet-stream",
      });
      form.append(`files[${i}]`, blob, f.name || `file-${i}`);
    }
  }

  const response = await fetch(
    `https://discord.com/api/v10/channels/${id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${token}`,
      },
      body: form,
    }
  );

  return response.json();
}

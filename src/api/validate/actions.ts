
"use server";

export async function validateToken(token: string) {
    const response = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
            Authorization: `Bot ${token}`,
        },
    });
    return response.json();
}
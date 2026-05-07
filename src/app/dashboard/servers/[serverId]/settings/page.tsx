import { ServerSettings } from "@/components/discord/server-settings";

interface PageProps {
  params: Promise<{ serverId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { serverId } = await params;
  return (
    <main className="h-screen flex flex-col">
      <ServerSettings guildId={serverId} />
    </main>
  );
}

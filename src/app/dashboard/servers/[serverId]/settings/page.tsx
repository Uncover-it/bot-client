import { Suspense } from "react";
import Spinner from "@/components/ui/spinner";
import { ServerSettings } from "@/components/discord/server-settings";

interface PageProps {
  params: Promise<{ serverId: string }>;
}

async function Settings({ params }: PageProps) {
  const { serverId } = await params;
  return <ServerSettings guildId={serverId} />;
}

export default function Page({ params }: PageProps) {
  // Same reason as the channel route: reading params behind Suspense lets the
  // shell prerender instead of blocking the whole route.
  return (
    <main className="h-screen flex flex-col">
      <Suspense
        fallback={
          <div className="flex-1 grid place-items-center">
            <Spinner size={16} />
          </div>
        }
      >
        <Settings params={params} />
      </Suspense>
    </main>
  );
}

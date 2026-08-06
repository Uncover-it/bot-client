import { Suspense } from "react";
import Spinner from "@/components/ui/spinner";
import { ChannelView } from "@/components/discord/channel-view";

interface PageProps {
  params: Promise<{ serverId: string; channelId: string }>;
}

// Mirrors ChannelView's outer shell so the swap does not shift layout.
function ChannelSkeleton() {
  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height: "calc(100dvh - var(--kb, 0px))" }}
    >
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-12 shrink-0 border-b" />
        <div className="flex-1 grid place-items-center">
          <Spinner size={16} />
        </div>
      </main>
    </div>
  );
}

async function Channel({ params }: PageProps) {
  const { serverId, channelId } = await params;
  return <ChannelView serverId={serverId} channelId={channelId} />;
}

export default function Page({ params }: PageProps) {
  // Awaiting params directly in the page body would keep the whole route from
  // prerendering. Reading them behind Suspense keeps navigation instant.
  return (
    <Suspense fallback={<ChannelSkeleton />}>
      <Channel params={params} />
    </Suspense>
  );
}

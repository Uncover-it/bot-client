import { Suspense } from "react";
import Spinner from "@/components/ui/spinner";
import { DmView } from "@/components/discord/dm-view";

interface PageProps {
  params: Promise<{ channelId: string }>;
}

// Mirrors DmView's outer shell so the swap does not shift layout.
function DmSkeleton() {
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

async function Dm({ params }: PageProps) {
  const { channelId } = await params;
  return <DmView channelId={channelId} />;
}

export default function Page({ params }: PageProps) {
  // Same reasoning as the channel route: reading params behind Suspense keeps
  // the route prerenderable and navigation instant.
  return (
    <Suspense fallback={<DmSkeleton />}>
      <Dm params={params} />
    </Suspense>
  );
}

import { ChannelView } from "@/components/discord/channel-view";

interface PageProps {
  params: Promise<{ serverId: string; channelId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { serverId, channelId } = await params;
  return <ChannelView serverId={serverId} channelId={channelId} />;
}

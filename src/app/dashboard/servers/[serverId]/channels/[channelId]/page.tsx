import MessageBox from "@/components/messagebox";
import { MessageList } from "@/components/messageList";

type PageProps = {
  params: {
    serverId: string;
    channelId: string;
  };
};


export default async function Page({ params }: PageProps) {
  const { serverId, channelId } = await params;
  return (
    <main className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto">
          <MessageList channelId={channelId} serverId={serverId} /> 
      </div>
      <footer className="shrink-0 p-2 pt-0 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.1),0_-4px_6px_-2px_rgba(0,0,0,0.05)] border-t z-50">
        <MessageBox id={channelId} />
      </footer>
    </main>
  );
}
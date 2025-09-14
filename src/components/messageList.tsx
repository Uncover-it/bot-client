"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { getMessages } from "@/api/data/actions";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { toast } from "sonner";

interface MessageProps {
  id: string;
  content: string;
  author: AuthorProps;
}

interface AuthorProps {
  username: string;
  bot: boolean;
  avatar: string;
  id: string;
}

function MessageSkeleton() {
  return (
    <div className="size-full absolute flex items-center text-center justify-center text-muted-foreground">
      <LoaderCircle className="animate-spin mr-2" />
      Loading
    </div>
  );
}

export function MessageList({ id }: { id: string }) {
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const fetchedMessages = await getMessages(id);
        setMessages(fetchedMessages);
        setLoading(false);
      } catch (e) {
        console.error("Failed to fetch messages:", e);
        setError("Failed to load messages.");
        setLoading(false);
      }
    };

    fetchMessages();

    const intervalId = setInterval(fetchMessages, 1000);

    return () => clearInterval(intervalId);
  }, [id]);

  if (loading) {
    return <MessageSkeleton />;
  }

  if (error) {
    return toast.error("Error", {description: error});
  }

  return (
    <div className="size-full flex flex-col-reverse justify-end p-4">
      {messages.map((message: MessageProps) => (
        <Message from={message.author.bot ? "user" : "assistant"} key={message.id}>
          <MessageAvatar
            src={`https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}`}
            name={message.author.username}
          />
          <MessageContent>
            <Response>{message.content}</Response>
          </MessageContent>
        </Message>
      ))}
    </div>
  );
}
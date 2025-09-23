"use client";

import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { useState } from "react";
import { toast } from "sonner";
import { sendMessage } from "@/api/data/actions";
import { Mic, SmilePlus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  EmojiPicker,
  EmojiPickerSearch,
  EmojiPickerContent,
  EmojiPickerFooter,
} from "@/components/ui/emoji-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function MessageBox({ id }: { id: string }) {
  const [text, setText] = useState<string>("");
  const [tts, setTTS] = useState<boolean>(false);

  const hasFileProp = (v: unknown): v is { file: File } =>
    typeof v === "object" &&
    v !== null &&
    "file" in v &&
    (v as { file?: unknown }).file instanceof File;

  async function handleSubmit(message: {
    text?: string;
    files?: (
      | File
      | { name?: string; type?: string; data?: ArrayBuffer }
      | { file?: File }
    )[];
  }) {
    const sendPromise = async () => {
      const content = message.text ?? text;
      const files = message.files
        ?.map((f) => {
          if (!f) return undefined;
          if (hasFileProp(f)) return f.file;
          if (f instanceof File) return f;
          return undefined;
        })
        .filter(Boolean) as File[] | undefined;

      let serializedFiles:
        | (File | { name?: string; type?: string; data?: ArrayBuffer })[]
        | undefined = undefined;
      if (files && files.length > 0) {
        serializedFiles = await Promise.all(
          files.map(async (f: File) => {
            const buf = await f.arrayBuffer();
            return {
              name: f.name,
              type: f.type,
              data: buf,
            };
          })
        );
      }

      const data = await sendMessage(
        id,
        tts,
        content,
        serializedFiles ?? files
      );
      if (data?.id) {
        setText("");
        return data;
      } else {
        throw new Error("Failed to send message");
      }
    };

    toast.promise(sendPromise(), {
      loading: "Sending",
      success: () => {
        return `Sent`;
      },
      error: (error) => {
        return `Error: ${error.message}`;
      },
    });
  }
  return (
    <PromptInput
      onSubmit={handleSubmit}
      className="mt-4 relative"
      globalDrop
      multiple
    >
      <PromptInputBody>
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>
        <PromptInputTextarea
          onChange={(e) => setText(e.target.value)}
          value={text}
          placeholder="Type something..."
        />
      </PromptInputBody>
      <PromptInputToolbar className="bg-sidebar">
        <PromptInputTools>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <PromptInputButton
                variant={tts ? "secondary" : "ghost"}
                onClick={() => setTTS(!tts)}
              >
                <Mic size={16} className={tts ? `text-primary` : ``} />
              </PromptInputButton>
            </TooltipTrigger>
            <TooltipContent>TTS</TooltipContent>
          </Tooltip>
          <Popover>
            <PopoverTrigger asChild>
              <PromptInputButton>
                <SmilePlus size={16} />
              </PromptInputButton>
            </PopoverTrigger>
            <PopoverContent className="w-fit p-0">
              <EmojiPicker
                className="isolate flex h-[368px] w-fit flex-col bg-white dark:bg-neutral-900 shadow-md"
                onEmojiSelect={({ emoji }) => {
                  setText((t) => t + emoji);
                }}
              >
                <EmojiPickerSearch className="z-10 mx-2 mt-2 appearance-none rounded-md bg-neutral-100 px-2.5 py-2 text-sm dark:bg-neutral-800" />
                <EmojiPickerContent />
                <EmojiPickerFooter />
              </EmojiPicker>
            </PopoverContent>
          </Popover>
        </PromptInputTools>
        <PromptInputSubmit disabled={!text} status={"ready"} />
      </PromptInputToolbar>
    </PromptInput>
  );
}

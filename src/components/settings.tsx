"use client";

import {
  DialogFooter,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";
import { updateBotInfo } from "@/api/data/actions";

export function BotSettings() {
  const [username, setUsername] = useState("");
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log(username);

    const loginPromise = async () => {
      const data = await updateBotInfo(username);
      console.log(data)
    };

    toast.promise(loginPromise(), {
      loading: "Updating username...",
      success: () => {
        return `Username updated successfully`;
      },
      error: (error) => {
        return `Error: ${error.message}`;
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Edit profile</DialogTitle>
        <DialogDescription>
          Make changes to your profile here. Click save when you&apos;re done.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 mt-4">
        <div className="grid gap-3">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            type="text"
            defaultValue="iloveuncoverit!!"
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter className="mt-4">
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button type="submit" disabled={!username}>
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

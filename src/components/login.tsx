"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { validateToken } from "@/api/validate/actions";
import { useState } from "react";
import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const [token, setToken] = useState("");
  const router = useRouter()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const regex = /[\w-]{24,26}\.[\w-]{6}\.[\w-]{25,110}/;
    if (regex.test(token)) {
      const data = await validateToken(token);
      if (data.username) {
        router.push("/dashboard")
      }
        else {
        toast.error("Error", {description: "Invalid Bot Token"})
      }
    } else {
      toast.error("Error", { description: "Invalid Bot Token" });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        placeholder="..."
        required
        id="token"
        type="text"
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
      <Button className="mt-4 w-full" variant={"default"} disabled={!token}>
        Login
      </Button>
    </form>
  );
}

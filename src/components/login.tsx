"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { validateToken } from "@/api/validate/actions";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const TOKEN_REGEX = /^[\w-]{24,28}\.[\w-]{6,7}\.[\w-]{25,120}$/;

export default function LoginForm() {
  const [token, setToken] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!TOKEN_REGEX.test(trimmed)) {
      toast.error("Invalid token format");
      return;
    }
    setBusy(true);
    const p = (async () => {
      const data = await validateToken(trimmed);
      if (!data?.username) {
        if (data?.code === 0) throw new Error("Invalid token");
        throw new Error(data?.message ?? "Login failed");
      }
      return data;
    })();

    toast.promise(p, {
      loading: "Logging in…",
      success: (data: { username: string }) => {
        router.push("/dashboard");
        return `Logged in as ${data.username}`;
      },
      error: (err) => `${err.message}`,
    });
    p.finally(() => setBusy(false));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Input
          required
          id="token"
          type={reveal ? "text" : "password"}
          value={token}
          autoComplete="off"
          spellCheck={false}
          placeholder="MTAwxxx.xxxxxx.xxx…"
          onChange={(e) => setToken(e.target.value)}
          className="pr-10 font-mono"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground",
          )}
          tabIndex={-1}
        >
          {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground text-left">
        Sent to this server to talk to Discord on your behalf. Stored only in an
        httpOnly session cookie. Not written to a database.
      </p>
      <Button className="w-full" disabled={!token || busy}>
        {busy ? "Logging in…" : "Login"}
      </Button>
    </form>
  );
}

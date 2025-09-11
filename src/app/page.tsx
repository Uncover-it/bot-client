import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import LoginForm from "@/components/login";
import Link from "next/link";

export default function Home() {
  return (
    <main className="overflow-hidden">
      <div aria-hidden className="absolute inset-0 isolate contain-strict z-0">
        <div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
        <div className="h-320 absolute left-0 top-0 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
        <div className="h-320 -translate-y-87.5 absolute left-0 top-0 w-60 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
      </div>
      <div className="min-h-screen flex flex-col justify-center items-center relative z-10 px-6">
        <div className="flex flex-col text-center">
          <h1 className="text-3xl text-balance font-semibold">
            Unofficial Discord Bot Client
          </h1>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Enter your bot token</CardTitle>
              <CardDescription>
                We don&apos;t store your data :)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
        <footer className="py-4 max-w-sm w-full">
          <div className="flex flex-col items-center justify-between gap-4 flex-row">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Uncover it. All rights reserved.
            </p>
            <div className="flex gap-4 justify-end items-center">
              <Link
                href="https://github.com/Uncover-it/bot-client"
                className="text-sm text-muted-foreground hover:underline"
                target="_blank"
              >
                Source
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import LoginForm from "@/components/login";
import Link from "next/link";
import { Suspense } from "react";
import { YearFooter } from "@/components/year-footer";

export default function Home() {
  return (
    <main className="overflow-hidden">
      <div className="min-h-screen flex flex-col justify-center items-center relative z-10 px-6">
        <div className="flex flex-col text-center">
          <h1 className="text-3xl text-balance font-semibold">
            Unofficial Discord Bot Client
          </h1>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Enter your bot token</CardTitle>
              <CardDescription>
                Stored only in an httpOnly session cookie. Self-host this client
                if you do not want a third party in the loop.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
        <footer className="py-4 max-w-sm w-full">
          <div className="flex flex-col items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              <Suspense fallback={null}>
                <YearFooter />
              </Suspense>
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

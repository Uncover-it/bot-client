"use client";

import { useTheme } from "next-themes";
import { Sun, MoonStar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      className="ml-auto size-7"
      variant="ghost"
      size={"icon"}
      onClick={() => (theme === "light" ? setTheme("dark") : setTheme("light"))}
    >
      <Sun className="dark:hidden block" />
      <MoonStar className="dark:block hidden" />
    </Button>
  );
}

"use client";
import { useEffect, useState } from "react";

/** Dark is the default. The choice is remembered per browser. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("theme", next);
        } catch {}
        setTheme(next);
      }}
      className="rounded-full border border-yardline px-3 py-1 text-sm text-chalk-dim hover:text-chalk"
      aria-label={`Switch to ${next} theme`}
    >
      {theme === "dark" ? "Day game" : "Night game"}
    </button>
  );
}

/** Runs before paint so a saved light theme never flashes dark. */
export const themeScript = `try{if(localStorage.getItem("theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

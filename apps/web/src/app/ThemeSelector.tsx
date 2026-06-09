"use client";

import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";

type ThemeOption = "system" | "light" | "dark";

const themeOptions = [
  { icon: SystemIcon, label: "System", value: "system" },
  { icon: SunIcon, label: "Light", value: "light" },
  { icon: MoonIcon, label: "Dark", value: "dark" }
] satisfies { icon: () => ReactNode; label: string; value: ThemeOption }[];

export function ThemeSelector() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const selectedTheme = mounted ? ((theme ?? "system") as ThemeOption) : "system";

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="fixed right-4 top-4 z-50">
      <div
        aria-label="Choose color theme"
        className="inline-flex rounded-full border border-loop-ink/15 bg-loop-surface p-1 text-loop-ink shadow-sm"
        role="radiogroup"
      >
        {themeOptions.map((option) => (
          <ThemeButton
            key={option.value}
            icon={option.icon}
            label={option.label}
            selected={selectedTheme === option.value}
            disabled={!mounted}
            onClick={() => setTheme(option.value)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeButton({
  disabled,
  icon: Icon,
  label,
  onClick,
  selected
}: {
  disabled: boolean;
  icon: () => ReactNode;
  label: string;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      type="button"
      aria-checked={selected}
      aria-label={`Use ${label.toLowerCase()} theme`}
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-loop-moss/25",
        selected
          ? "bg-loop-moss text-white shadow-sm"
          : "text-loop-ink/65 hover:bg-loop-mist hover:text-loop-ink",
        disabled ? "cursor-wait opacity-70" : ""
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      role="radio"
      title={label}
    >
      <Icon />
    </button>
  );
}

function SystemIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="2" width="18" x="3" y="4" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 7 7 0 1 0 20.5 15.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        loop: {
          ink: "rgb(var(--color-loop-ink) / <alpha-value>)",
          moss: "rgb(var(--color-loop-moss) / <alpha-value>)",
          leaf: "rgb(var(--color-loop-leaf) / <alpha-value>)",
          sun: "rgb(var(--color-loop-sun) / <alpha-value>)",
          mist: "rgb(var(--color-loop-mist) / <alpha-value>)",
          surface: "rgb(var(--color-loop-surface) / <alpha-value>)"
        }
      }
    }
  },
  plugins: []
};

export default config;

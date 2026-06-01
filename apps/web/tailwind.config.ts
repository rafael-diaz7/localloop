import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        loop: {
          ink: "#17201b",
          moss: "#2d6a4f",
          leaf: "#52b788",
          sun: "#f2cc8f",
          mist: "#f6f8f4"
        }
      }
    }
  },
  plugins: []
};

export default config;

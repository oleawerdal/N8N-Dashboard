import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0e14",
        panel: "#11151c",
        border: "#1f2733",
        muted: "#7d8794",
        accent: "#5b8def",
      },
    },
  },
  plugins: [],
} satisfies Config;

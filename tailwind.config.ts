import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        mist: "#eef2ff",
        line: "#dbe4f0",
        accent: "#0f766e",
        accentSoft: "#ccfbf1",
        canvas: "#f7f9fc",
        panel: "#ffffff",
      },
      boxShadow: {
        soft: "0 18px 40px rgba(15, 23, 42, 0.08)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

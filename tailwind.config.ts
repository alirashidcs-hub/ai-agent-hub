import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#08080C",
        "bg-soft": "#0C0C12",
        panel: "rgba(18,18,26,0.72)",
        "panel-solid": "#111118",
        border: "rgba(255,255,255,0.07)",
        "border-hover": "rgba(255,255,255,0.14)",
        ink: "#F1F1F4",
        "ink-mid": "#9797A6",
        "ink-faint": "#54545F",
        indigo: { DEFAULT: "#6366F1", 600: "#4F46E5" },
        purple: { DEFAULT: "#A855F7", 600: "#9333EA" },
        cyan: "#22D3EE",
        brand: {
          green: "#2DD4A0",
          amber: "#F5A623",
          red: "#F2555A",
        },
      },
      borderRadius: {
        card: "18px",
        node: "14px",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #6366F1, #A855F7)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

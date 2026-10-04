import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      transitionTimingFunction: {
        applyswipe: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      transitionDuration: {
        "180": "180ms",
      },
      colors: {
        background: "#05070D",
        surface: {
          DEFAULT: "#0A0F1C",
          hover: "#0F172A",
          active: "#1E293B",
          card: "#0D1322",
          elevated: "#131C31",
        },
        primary: {
          DEFAULT: "#6366F1",
          foreground: "#FFFFFF",
          hover: "#4F46E5",
          light: "#818CF8",
          dark: "#4338CA",
        },
        secondary: {
          DEFAULT: "#8B5CF6",
          foreground: "#FFFFFF",
          hover: "#7C3AED",
        },
        accent: {
          DEFAULT: "#22C55E",
          foreground: "#FFFFFF",
          hover: "#16A34A",
          muted: "rgba(34, 197, 94, 0.15)",
        },
        danger: {
          DEFAULT: "#EF4444",
          foreground: "#FFFFFF",
          hover: "#DC2626",
          muted: "rgba(239, 68, 68, 0.15)",
        },
        warning: {
          DEFAULT: "#F59E0B",
          foreground: "#000000",
        },
        foreground: "#F8FAFC",
        muted: {
          DEFAULT: "#94A3B8",
          foreground: "#64748B",
        },
        border: "rgba(255, 255, 255, 0.08)",
        "border-bright": "rgba(255, 255, 255, 0.16)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "0.9", transform: "scale(1.05)" },
        },
        shimmer: {
          "100%": {
            transform: "translateX(100%)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
      },
      boxShadow: {
        glow: "0 0 25px -5px rgba(99, 102, 241, 0.3)",
        "glow-accent": "0 0 25px -5px rgba(34, 197, 94, 0.3)",
        card: "0 8px 30px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

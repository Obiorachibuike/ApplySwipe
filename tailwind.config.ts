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
        background: "var(--background)",
        surface: {
          DEFAULT: "var(--surface)",
          hover: "var(--surface-hover)",
          active: "#1E293B",
          card: "var(--surface-card)",
          elevated: "var(--surface-elevated)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "#FFFFFF",
          hover: "var(--primary-hover)",
          light: "var(--primary-light)",
          dark: "var(--primary-dark)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "#FFFFFF",
          hover: "var(--secondary-hover)",
        },
        like: {
          DEFAULT: "var(--like)",
          hover: "var(--like-hover)",
          fg: "var(--like-fg)",
        },
        pass: {
          DEFAULT: "var(--pass)",
          hover: "var(--pass-hover)",
          bg: "var(--pass-bg)",
          fg: "var(--pass-fg)",
        },
        accent: {
          DEFAULT: "var(--like)",
          foreground: "#FFFFFF",
          hover: "var(--like-hover)",
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
        foreground: "var(--text)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        "border-bright": "var(--border-bright)",
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
        glow: "0 0 25px -5px rgba(99, 102, 241, 0.35)",
        "glow-accent": "0 0 25px -5px rgba(34, 197, 94, 0.35)",
        "glow-pass": "0 0 25px -5px rgba(251, 113, 133, 0.3)",
        card: "var(--card-shadow)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

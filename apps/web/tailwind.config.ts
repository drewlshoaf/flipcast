import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0b1220",
          700: "#1f2a3d",
          500: "#475569",
          400: "#64748b",
          300: "#94a3b8",
        },
        brand: {
          sky: "#38bdf8",
          skyDeep: "#0ea5e9",
          pink: "#f472b6",
          pinkDeep: "#ec4899",
          mint: "#34d399",
          mintDeep: "#10b981",
        },
        surface: {
          DEFAULT: "#ffffff",
          soft: "rgba(255,255,255,0.72)",
          tint: "#f6f9ff",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(56, 189, 248, 0.18), 0 6px 14px -6px rgba(236, 72, 153, 0.10)",
        cardHover:
          "0 20px 50px -18px rgba(56, 189, 248, 0.28), 0 12px 24px -10px rgba(236, 72, 153, 0.16)",
        glow: "0 24px 60px -18px rgba(52, 211, 153, 0.35)",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #38bdf8 0%, #f472b6 50%, #34d399 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, rgba(56,189,248,0.14) 0%, rgba(244,114,182,0.14) 50%, rgba(52,211,153,0.14) 100%)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "shimmer-bar": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "shimmer-bar": "shimmer-bar 1.8s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

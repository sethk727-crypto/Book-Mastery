import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0b0e14",
          raised: "#131722",
          overlay: "#1b2130",
        },
        accent: {
          DEFAULT: "#6366f1",
          soft: "#818cf8",
        },
        orp: "#ef4444",
        // Atmospheric brand palette — sunrise to midnight.
        atmos: {
          dawnGold: "#FFC857",
          coral: "#FF8A65",
          lavender: "#E2C0FF",
          azure: "#3A86FF",
          skyClassic: "#87CEEB",
          mist: "#DCEEFA",
          amber: "#F06543",
          crimson: "#D9381E",
          twilight: "#7B2CBF",
          indigo: "#1D2D50",
          midnight: "#0B132B",
          slate: "#1C2541",
        },
      },
      fontFamily: {
        reader: ["Georgia", "ui-serif", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        pulseRing: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

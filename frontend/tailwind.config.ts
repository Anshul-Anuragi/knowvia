import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        space: {
          950: "#060919",
          900: "#0B1026",
          850: "#0F1633",
          800: "#141D42",
          700: "#1D2859",
        },
        brand: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-pulse": "glow 2.5s ease-in-out infinite alternate",
        "blink": "blink 1s step-end infinite",
      },
      keyframes: {
        glow: {
          "0%": {
            boxShadow:
              "0 0 15px rgba(99, 102, 241, 0.25), 0 0 30px rgba(124, 58, 237, 0.15)",
          },
          "100%": {
            boxShadow:
              "0 0 25px rgba(99, 102, 241, 0.5), 0 0 50px rgba(124, 58, 237, 0.3)",
          },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;

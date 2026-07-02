/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surface palette — these come from --pt-surface-* CSS vars.
        ink: {
          950: "#070709",
          900: "#0a0a0f",
          800: "#101018",
          700: "#15151c",
          600: "#1c1c25",
          500: "#26262f",
        },
        edge: {
          DEFAULT: "rgba(255,255,255,0.08)",
          hot: "rgba(255,255,255,0.16)",
        },
        text: {
          high: "#e7e7ee",
          mid:  "#a4a4b3",
          low:  "#5a5a6a",
        },
        // Accent system. Default is cyan; theme switch swaps these vars.
        accent: {
          DEFAULT: "rgb(var(--pt-accent) / <alpha-value>)",
          dim: "rgb(var(--pt-accent-dim) / <alpha-value>)",
          glow: "rgb(var(--pt-accent-glow) / <alpha-value>)",
        },
        sig: {
          cyan:    "#5cf2ff",
          magenta: "#ff5cd1",
          violet:  "#a48bff",
          lime:    "#b6ff5c",
          amber:   "#ffae5c",
          rose:    "#ff5c7a",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Source Han Sans SC"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "ui-monospace", "monospace"],
        display: ['"Space Grotesk"', '"Inter"', "sans-serif"],
      },
      fontFeatureSettings: {
        nums: '"tnum", "lnum"',
      },
      backdropBlur: {
        glass: "20px",
        heavy: "40px",
      },
      borderRadius: {
        // The whole system uses 4px / 6px / 10px max — flat aesthetic.
        sharp: "2px",
        soft: "6px",
        pill: "999px",
      },
      animation: {
        "scan-line":   "scan 4s linear infinite",
        "pulse-soft":  "pulse-soft 2.2s ease-in-out infinite",
        "shimmer":     "shimmer 3s linear infinite",
        "cursor-blink":"cursor-blink 1.1s steps(1) infinite",
      },
      keyframes: {
        scan: {
          "0%":   { transform: "translateY(-100%)", opacity: "0" },
          "10%":  { opacity: "0.6" },
          "90%":  { opacity: "0.6" },
          "100%": { transform: "translateY(100%)", opacity: "0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.4" },
          "50%":      { opacity: "1" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "cursor-blink": {
          "0%, 49%":   { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

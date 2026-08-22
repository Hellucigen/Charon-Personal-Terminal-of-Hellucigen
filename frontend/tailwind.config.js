/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces — light industrial palette from --pt-* CSS vars.
        bg: "rgb(var(--pt-bg) / <alpha-value>)",
        surface: {
          DEFAULT: "rgb(var(--pt-surface) / <alpha-value>)",
          2: "rgb(var(--pt-surface-2) / <alpha-value>)",
          3: "rgb(var(--pt-surface-3) / <alpha-value>)",
        },
        edge: {
          DEFAULT: "rgb(var(--pt-edge) / 0.16)",
          hot: "rgb(var(--pt-edge) / 0.34)",
        },
        text: {
          hi: "rgb(var(--pt-text-hi) / <alpha-value>)",
          high: "rgb(var(--pt-text-hi) / <alpha-value>)",
          mid: "rgb(var(--pt-text-mid) / <alpha-value>)",
          lo: "rgb(var(--pt-text-lo) / <alpha-value>)",
          low: "rgb(var(--pt-text-lo) / <alpha-value>)",
        },
        // Dual accent: orange = action/user, teal = focus/system.
        accent: {
          DEFAULT: "rgb(var(--pt-accent) / <alpha-value>)",
          dim: "rgb(var(--pt-accent-dim) / <alpha-value>)",
          glow: "rgb(var(--pt-accent-glow) / <alpha-value>)",
        },
        teal: {
          DEFAULT: "rgb(var(--pt-teal) / <alpha-value>)",
          dim: "rgb(var(--pt-teal-dim) / <alpha-value>)",
        },
        sig: {
          cyan:    "rgb(var(--sig-cyan) / <alpha-value>)",
          magenta: "rgb(var(--sig-magenta) / <alpha-value>)",
          violet:  "rgb(var(--sig-violet) / <alpha-value>)",
          lime:    "rgb(var(--sig-lime) / <alpha-value>)",
          amber:   "rgb(var(--sig-amber) / <alpha-value>)",
          rose:    "rgb(var(--sig-rose) / <alpha-value>)",
          warn:    "rgb(var(--sig-amber) / <alpha-value>)",
          error:   "rgb(var(--sig-rose) / <alpha-value>)",
          ok:      "rgb(var(--sig-lime) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ['"Barlow Semi Condensed"', '"Noto Sans SC"', '"Microsoft YaHei"', "system-ui", "sans-serif"],
        mono: ['"Share Tech Mono"', '"JetBrains Mono"', '"Consolas"', "ui-monospace", "monospace"],
        display: ['"Barlow Semi Condensed"', '"Noto Sans SC"', "sans-serif"],
      },
      fontFeatureSettings: {
        nums: '"tnum", "lnum"',
      },
      borderRadius: {
        // Flat aesthetic: 2px max on containers; pills use .pt-chip.
        sharp: "0px",
        soft: "2px",
        pill: "10px",
      },
      animation: {
        "pulse-soft":  "pulse-soft 2.2s ease-in-out infinite",
        "shimmer":     "shimmer 3s linear infinite",
        "cursor-blink":"cursor-blink 1.1s steps(1) infinite",
      },
      keyframes: {
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

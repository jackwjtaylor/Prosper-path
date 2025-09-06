import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        prosper: {
          green: {
            main: "var(--prosper-green-main)",
            dark: "var(--prosper-green-dark)",
            light: "var(--prosper-green-light)",
          },
          accent: {
            gold: "var(--prosper-accent-gold)",
            teal: "var(--prosper-accent-teal)",
          },
          neutral: {
            "dark-ink": "var(--prosper-neutral-dark-ink)",
            text: "var(--prosper-neutral-text)",
            background: "var(--prosper-neutral-background)",
            divider: "var(--prosper-neutral-divider)",
          },
          semantic: {
            success: "var(--prosper-semantic-success)",
            warning: "var(--prosper-semantic-warning)",
            error: "var(--prosper-semantic-error)",
            info: "var(--prosper-semantic-info)",
          },
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
} satisfies Config;

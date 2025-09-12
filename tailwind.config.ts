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
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: "var(--brand)",
        brandink: "var(--brand-ink)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        risk: "var(--risk)",
        card: "var(--card)",
        muted: "var(--muted)",
        border: "var(--border)",
        // Landing page color tokens
        bg: '#0B0B0F',
        fg: '#F5F7FB',
        dim: 'rgba(245,247,251,0.6)',
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
    },
  },
  plugins: [],
} satisfies Config;

/**
  * ERANDER Tailwind Design System
  * Source of truth: src/index.css
  * Use semantic tokens: brand, surface, content, line, success
 */

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--erander-navy)",
          navy: "var(--erander-navy)",
          deep: "var(--erander-navy-deep)",
          soft: "var(--erander-navy-soft)",
          green: "var(--erander-green)",
          greenHover: "var(--erander-green-hover)",
          mint: "var(--erander-mint)",
          pale: "var(--erander-pale)",
        },
        surface: {
          DEFAULT: "var(--erander-white)",
          white: "var(--erander-white)",
          muted: "var(--erander-surface)",
          soft: "var(--erander-surface-muted)",
          offwhite: "var(--erander-off-white)",
          dark: "var(--erander-surface-dark)",
          deepest: "var(--erander-dark)",
        },
        content: {
          DEFAULT: "var(--erander-text)",
          muted: "var(--erander-text-muted)",
          subtle: "var(--erander-text-subtle)",
          inverse: "var(--erander-text-inverse)",
        },
        line: {
          DEFAULT: "var(--erander-border)",
          soft: "var(--erander-border-soft)",
          strong: "var(--erander-border-strong)",
          surface: "var(--erander-border-surface)",
        },
        success: {
          DEFAULT: "var(--erander-success)",
          dark: "var(--erander-success-dark)",
          soft: "var(--erander-success-soft)",
        },
        warning: {
          DEFAULT: "var(--erander-warning)",
          soft: "var(--erander-warning-soft)",
        },
        danger: {
          DEFAULT: "var(--erander-danger)",
          soft: "var(--erander-danger-soft)",
        },

        // Backward-compat: old slate-* now maps to ERANDER tokens
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "var(--erander-border)",
          300: "var(--erander-border-strong)",
          400: "var(--erander-text-subtle)",
          500: "var(--erander-text-muted)",
          600: "#475569",
          700: "var(--erander-navy)",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        // Backward-compat: old emerald-* now maps to NEW deeper green
        emerald: {
          50: "var(--erander-pale)",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "var(--erander-mint)",
          500: "var(--erander-green)",
          600: "var(--erander-green-hover)",
          700: "var(--erander-success)",
          800: "var(--erander-success-dark)",
          900: "#14532d",
          950: "#052e16",
        },
      },

      fontFamily: {
        sans: ["Manrope", "sans-serif"],
        manrope: ["Manrope", "sans-serif"],
      },

      maxWidth: {
        erander: "var(--container-erander)",
        page: "1440px",
      },

      borderRadius: {
        card: "var(--radius-card)",
        block: "var(--radius-block)",
        pill: "var(--radius-pill)",
      },

      boxShadow: {
        "erander-card": "var(--shadow-erander-card)",
        "erander-card-hover": "var(--shadow-erander-card-hover)",
        "erander-pop": "var(--shadow-erander-pop)",
      },

      transitionTimingFunction: {
        erander: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [],
};
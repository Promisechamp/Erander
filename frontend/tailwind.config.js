
/**
 * ERANDER Tailwind Design System
 * Source of truth: design.md
 *
 * Keep brand values in the global CSS custom properties.
 * Prefer semantic tokens (brand, surface, content, line, success)
 * in new UI. Legacy slate/emerald aliases are retained for migration.
 */

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      /* =========================================
         ERANDER BRAND TOKENS
      ========================================= */

      colors: {
        brand: {
          DEFAULT: "var(--erander-navy)",
          navy: "var(--erander-navy)",
          green: "var(--erander-green)",
          mint: "var(--erander-mint)",
          pale: "var(--erander-pale)",
        },

        /* Backgrounds and component surfaces */
        surface: {
          DEFAULT: "var(--erander-white)",
          white: "var(--erander-white)",
          muted: "var(--erander-surface)",
          soft: "var(--erander-surface-muted)",
          dark: "var(--erander-surface-dark)",
          deepest: "var(--erander-dark)",
        },

        /* Text colours */
        content: {
          DEFAULT: "var(--erander-text)",
          muted: "var(--erander-text-muted)",
          subtle: "var(--erander-text-subtle)",
          inverse: "var(--erander-text-inverse)",
        },

        /* Borders and separators */
        line: {
          DEFAULT: "var(--erander-border)",
          soft: "var(--erander-border-soft)",
          strong: "var(--erander-border-strong)",
          surface: "var(--erander-border-surface)",
        },

        /* Semantic feedback */
        success: {
          DEFAULT: "var(--erander-success)",
          dark: "var(--erander-success-dark)",
          soft: "var(--erander-success-soft)",
        },

        /*
         * Backward-compatibility aliases.
         * Keep these while existing pages still use slate-* classes.
         * Prefer brand/surface/content/line/success in new code.
         */
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

        /*
         * Backward-compatibility aliases for existing emerald-* classes.
         * New components should use brand-* and success-* tokens.
         */
        emerald: {
          50: "var(--erander-pale)",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "var(--erander-mint)",
          500: "var(--erander-green)",
          600: "#16a875",
          700: "var(--erander-success)",
          800: "var(--erander-success-dark)",
          900: "#14532d",
          950: "#052e16",
        },
      },

      /* =========================================
         TYPOGRAPHY
      ========================================= */

      fontFamily: {
        sans: ["Manrope", "sans-serif"],
        manrope: ["Manrope", "sans-serif"],
      },

      /* =========================================
         LAYOUT
      ========================================= */

      maxWidth: {
        erander: "var(--container-erander)",
      },

      /* =========================================
         ELEVATION
      ========================================= */

      boxShadow: {
        "erander-card": "var(--shadow-erander-card)",
        "erander-card-hover": "var(--shadow-erander-card-hover)",
      },

      /* =========================================
         MOTION
      ========================================= */

      transitionTimingFunction: {
        erander: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },

  plugins: [],
};

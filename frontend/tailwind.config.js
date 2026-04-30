/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FFBF00",
          foreground: "#000000"
        },
        secondary: {
          DEFAULT: "#007AFF",
          foreground: "#FFFFFF"
        },
        // Industrial steel-blue accent
        steel: {
          50: "#F0F4F8",
          100: "#D9E2EC",
          400: "#486581",
          500: "#334E68",
          600: "#243B53",
          700: "#102A43",
        },
        // Amber hierarchy (primary brand)
        amber: {
          100: "#FFF4D1",
          400: "#FFD24C",
          500: "#FFBF00",
          600: "#E6A800",
          700: "#B38200",
        },
        background: "#09090B",
        surface: "#18181B",
        "surface-highlight": "#27272A",
        "surface-elevated": "#1F1F23",
        "text-primary": "#FAFAFA",
        "text-secondary": "#A1A1AA",
        "text-muted": "#71717A",
        border: "#27272A",
        "border-subtle": "#1F1F23",
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        info: "#3B82F6"
      },
      fontFamily: {
        heading: ['Barlow Condensed', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      boxShadow: {
        "industrial": "0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)",
        "industrial-lg": "0 2px 4px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.4)",
        "gold-glow": "0 0 0 1px rgba(255,191,0,0.25), 0 8px 24px rgba(255,191,0,0.15)",
        "steel-glow": "0 0 0 1px rgba(72,101,129,0.3), 0 8px 24px rgba(16,42,67,0.35)",
        "inner-hairline": "inset 0 1px 0 rgba(255,255,255,0.04)",
      },
      backgroundImage: {
        "grain": "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.06 0'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>\")",
        "industrial-radial": "radial-gradient(1200px 500px at 80% -10%, rgba(255,191,0,0.08), transparent 60%), radial-gradient(900px 400px at -10% 110%, rgba(16,42,67,0.25), transparent 55%)",
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0B0D12",
          surface: "#161A22",
          card: "#1E232E",
        },
        brand: {
          DEFAULT: "#00E55A",
          hover: "#00C24B",
          glow: "#00FF66",
        },
        gold: "#FACC15",
        ink: "#F9FAFB",
        muted: "#9CA3AF",
      },
      fontFamily: {
        display: ['"Clash Display"', '"Space Grotesk"', "system-ui", "sans-serif"],
        body: ['"Manrope"', "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        glow: "0 0 60px -10px rgba(0, 229, 90, 0.35)",
        card: "0 24px 80px -20px rgba(0, 0, 0, 0.6)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, rgba(11,13,18,0) 0%, #0B0D12 85%), linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        "radial-brand":
          "radial-gradient(circle at 50% 0%, rgba(0,229,90,0.18) 0%, transparent 55%)",
      },
      animation: {
        "pulse-soft": "pulse 4s ease-in-out infinite",
        "marquee": "marquee 40s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};

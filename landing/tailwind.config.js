/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        brand: {
          blue: "#1E4FD8",        // primary deep royal blue
          "blue-600": "#1741B8",  // hover / press
          "blue-700": "#0F2F8F",  // deep
          "blue-900": "#0A2570",  // darkest
          "blue-50": "#EEF3FF",   // very light tint
          "blue-100": "#DCE6FF",
          orange: "#F58220",      // CTA orange (warm vibrant)
          "orange-600": "#E06B00",
          "orange-50": "#FFF3E6",
          yellow: "#FFC107",      // yellow accent from ball
        },
        // Neutrals
        ink: "#0B1833",           // text primary (near-black blue)
        ink2: "#1F2A44",          // text deep
        muted: "#5B6B88",         // text secondary
        muted2: "#8A96AE",
        line: "#E4EAF4",          // subtle border
        line2: "#CFD8EA",
        bg: {
          base: "#FFFFFF",
          soft: "#F6F9FE",        // cream/soft blue bg
          tint: "#EEF3FF",        // brand tint
        },
      },
      fontFamily: {
        display: ['"Clash Display"', '"Space Grotesk"', "system-ui", "sans-serif"],
        body: ['"Manrope"', "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.035em",
      },
      boxShadow: {
        card: "0 12px 40px -12px rgba(15, 47, 143, 0.15)",
        cta: "0 14px 35px -10px rgba(245, 130, 32, 0.5)",
        blue: "0 14px 40px -10px rgba(30, 79, 216, 0.35)",
        soft: "0 4px 20px -6px rgba(11, 24, 51, 0.08)",
      },
      backgroundImage: {
        "brand-radial":
          "radial-gradient(circle at 50% 0%, rgba(30, 79, 216, 0.08) 0%, transparent 60%)",
        "orange-radial":
          "radial-gradient(circle at 50% 50%, rgba(245, 130, 32, 0.12) 0%, transparent 65%)",
      },
      animation: {
        "pulse-soft": "pulse 4s ease-in-out infinite",
        marquee: "marquee 45s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
    },
  },
  plugins: [],
};

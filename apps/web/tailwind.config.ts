  import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#fafaf8",
        ink: "#1a1a1a",
        line: "rgba(82, 129, 99, 0.18)",
        teal: {
          50:  "#e9efec",
          100: "#c8d6cd",
          200: "#a6bcae",
          300: "#85a290",
          400: "#6c9079",
          500: "#528163",
          600: "#467157",
          700: "#385a46",
          800: "#2a4434",
          900: "#1d2e23",
        },
        orange: {
          50:  "#fdf0e8",
          100: "#fbdcc6",
          200: "#f8c8a4",
          300: "#f5b282",
          400: "#f39d66",
          500: "#f1874b",
          600: "#d57038",
          700: "#a4562b",
          800: "#733c1e",
          900: "#432311",
        },
        lime: {
          50:  "#f4f8e6",
          100: "#e6f0c4",
          200: "#d9e7a2",
          300: "#ccdf80",
          400: "#c1d870",
          500: "#bad25f",
          600: "#a2b84d",
          700: "#7e8f3d",
          800: "#5a662c",
          900: "#363d1b",
        },
        grass: {
          500: "#81ae3d",
          600: "#6f9833",
          700: "#5a7a2a",
        },
      },
      fontFamily: {
        display: ['"Dosis"', "system-ui", "sans-serif"],
        sans: ['"Dosis"', "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #81ae3d 0%, #528163 100%)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(82, 129, 99, 0.06), 0 1px 6px rgba(82, 129, 99, 0.04)",
      },
    },
  },
  plugins: [],
} satisfies Config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        milky: {
          50: "#fff8f1",
          100: "#feecdc",
          200: "#fcd9bd",
          400: "#ff8a4c",
          500: "#ff5a1f",
          600: "#d03801",
        },
      },
    },
  },
  plugins: [],
};
export default config;

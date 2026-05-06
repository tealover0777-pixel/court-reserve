/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#556d00",
        "on-primary": "#ffffff",
        "primary-container": "#cafd00",
        "on-primary-container": "#4a5e00",
        "secondary": "#5c647a",
        "on-secondary": "#ffffff",
        "secondary-container": "#dae2fd",
        "on-secondary-container": "#4a5167",
        "surface": "#fffbff",
        "on-surface": "#3b3a06",
        "surface-variant": "#efec93",
        "on-surface-variant": "#686730",
        "background": "#fffbff",
        "on-background": "#3b3a06",
        "outline": "#858349",
        "outline-variant": "#bfbc7c",
        "surface-container-low": "#fffcca",
        "surface-container-high": "#f5f29d",
        "surface-container-highest": "#efec93",
        "tertiary-container": "#fce047",
        "on-tertiary-container": "#5d5000",
      },
      fontFamily: {
        headline: ["Lexend", "sans-serif"],
        body: ["Manrope", "sans-serif"],
        label: ["Manrope", "sans-serif"],
      },
    },
  },
  plugins: [],
};

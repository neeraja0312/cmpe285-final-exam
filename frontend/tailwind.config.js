/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        accent: "#ff5a8a",
        like: "#22c55e",
        nope: "#ef4444",
      },
      boxShadow: {
        card: "0 20px 50px -12px rgba(15, 23, 42, 0.45)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

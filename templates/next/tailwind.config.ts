/* eslint-disable @typescript-eslint/no-require-imports */
import defaultTheme from "tailwindcss/defaultTheme";
import { Config } from "tailwindcss/types/config";

import colorsJson from "./colors.json";

const colors = Object.keys(colorsJson).reduce(
  (acc, key) => {
    acc[key] = `var(--${key})`;
    return acc;
  },
  {} as Record<string, string>,
);

const sizes = Array.from({ length: 1000 }, (_, i) => i).reduce(
  (acc, curr) => {
    acc[curr] = `${curr}px`;
    return acc;
  },
  {
    max: "max-content",
    unset: "unset",
    full: "100%",
    inherit: "inherit",
    "1/2": "50%",
    "1/3": "33.3%",
    "2/3": "66.6%",
    "1/4": "25%",
  } as Record<string, string>,
);

const opacities = Array.from({ length: 100 }, (_, i) => i).reduce(
  (acc, curr) => {
    acc[curr] = curr / 100 + "";
    return acc;
  },
  {} as Record<string, string>,
);

const transitionDurations = Array.from({ length: 60 }, (_, i) => i).reduce(
  (acc, curr) => {
    acc[curr] = curr * 50 + "";
    return acc;
  },
  {} as Record<string, string>,
);

const themeConfig: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./node_modules/streamdown/dist/*.js",
    "./node_modules/@streamdown/code/dist/*.js",
    "./node_modules/@streamdown/mermaid/dist/*.js",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["SuisseIntl", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-geist-mono)", ...defaultTheme.fontFamily.mono],
      },
      fontSize: {
        "title-h1": ["60px", { lineHeight: "64px", letterSpacing: "-0.3px", fontWeight: "500" }],
        "title-h2": ["52px", { lineHeight: "56px", letterSpacing: "-0.52px", fontWeight: "500" }],
        "title-h3": ["40px", { lineHeight: "44px", letterSpacing: "-0.4px", fontWeight: "500" }],
        "title-h4": ["32px", { lineHeight: "36px", letterSpacing: "-0.32px", fontWeight: "500" }],
        "title-h5": ["24px", { lineHeight: "32px", letterSpacing: "-0.24px", fontWeight: "500" }],
        "body-x-large": ["20px", { lineHeight: "28px", letterSpacing: "-0.1px", fontWeight: "400" }],
        "body-large": ["16px", { lineHeight: "24px", letterSpacing: "0px", fontWeight: "400" }],
        "body-medium": ["14px", { lineHeight: "20px", letterSpacing: "0.14px", fontWeight: "400" }],
        "body-small": ["13px", { lineHeight: "20px", letterSpacing: "0px", fontWeight: "400" }],
        "body-input": ["15px", { lineHeight: "24px", letterSpacing: "0px", fontWeight: "400" }],
        "label-x-large": ["20px", { lineHeight: "28px", letterSpacing: "-0.1px", fontWeight: "450" }],
        "label-large": ["16px", { lineHeight: "24px", letterSpacing: "0px", fontWeight: "450" }],
        "label-medium": ["14px", { lineHeight: "20px", letterSpacing: "0px", fontWeight: "450" }],
        "label-small": ["13px", { lineHeight: "20px", letterSpacing: "0px", fontWeight: "450" }],
        "label-x-small": ["12px", { lineHeight: "20px", letterSpacing: "0px", fontWeight: "450" }],
        "mono-medium": ["14px", { lineHeight: "22px", letterSpacing: "0px", fontWeight: "400" }],
        "mono-small": ["13px", { lineHeight: "20px", letterSpacing: "0px", fontWeight: "500" }],
        "mono-x-small": ["12px", { lineHeight: "16px", letterSpacing: "0px", fontWeight: "400" }],
      },
      colors: {
        transparent: "transparent",
        current: "currentColor",
        ...colors,
        // shadcn/streamdown color system
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          border: "hsl(var(--sidebar-border))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
        },
      },
      screens: {
        xs: { min: "390px" },
        "xs-max": { max: "389px" },
        sm: { min: "576px" },
        "sm-max": { max: "575px" },
        md: { min: "768px" },
        "md-max": { max: "767px" },
        lg: { min: "996px" },
        "lg-max": { max: "995px" },
        xl: { min: "1200px" },
        "xl-max": { max: "1199px" },
      },
      opacity: opacities,
      spacing: { ...sizes, root: "var(--root-padding)" },
      width: sizes,
      maxWidth: sizes,
      height: sizes,
      inset: sizes,
      borderWidth: sizes,
      backdropBlur: Array.from({ length: 20 }, (_, i) => i).reduce(
        (acc, curr) => {
          acc[curr] = curr + "px";
          return acc;
        },
        {} as Record<string, string>,
      ),
      transitionTimingFunction: { DEFAULT: "cubic-bezier(0.25, 0.1, 0.25, 1)" },
      transitionDuration: { DEFAULT: "200ms", ...transitionDurations },
      transitionDelay: { ...transitionDurations },
      borderRadius: (() => {
        const radius: Record<string | number, string> = { full: "999px", inherit: "inherit", 0: "0px" };
        for (let i = 1; i <= 32; i += 1) radius[i] = `${i}px`;
        return radius;
      })(),
    },
  },
  corePlugins: { container: false },
  plugins: [
    ({ addUtilities, matchUtilities }: any) => {
      addUtilities({
        ".inside-border": { "@apply pointer-events-none absolute inset-0 rounded-inherit border transition-all": {} },
        ".flex-center": { "@apply flex items-center justify-center": {} },
        ".overlay": { "@apply absolute top-0 left-0 w-full h-full rounded-inherit": {} },
        ".text-gradient": { "@apply !bg-clip-text !text-transparent": {} },
      });
      matchUtilities(
        {
          mw: (value: string) => {
            const [maxWidth, paddingX] = value.split(",").map((v) => parseInt(v));
            const width = paddingX ? `calc(100% - ${paddingX * 2}px)` : "100%";
            return { maxWidth, width };
          },
        },
        { values: sizes },
      );
    },
    require("tailwind-gradient-mask-image"),
    require("@tailwindcss/typography"),
  ],
};

export default themeConfig;

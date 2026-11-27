import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
 * Portal data fences (plan frontend-portal-admin-plan.md §1.1; also
 * src/data/fences.test.ts): pages and components reach portal data only
 * through "@/data", never an adapter; public pages never touch it at all.
 */
const ADAPTERS = {
  group: ["@/data/mock", "@/data/mock/*", "@/data/live", "@/data/live/*", "**/data/mock/**", "**/data/live/**"],
  message: "Import portal data from \"@/data\" (the interface), never an adapter.",
};
const PORTAL_FILES = [
  "src/app/a/**",
  "src/app/p/**",
  "src/app/s/**",
  "src/app/t/**",
  "src/app/login/**",
  "src/app/forgot-password/**",
  "src/app/actions/auth.ts",
  // The /enroll action writes through the interface on the dev preview; it reads nothing back onto a public page.
  "src/app/actions/enroll.ts",
  "src/components/portal/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/data/**", "src/lib/auth/**", ...PORTAL_FILES],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ADAPTERS,
            { group: ["@/data", "@/data/*"], message: "Public pages and shared code never read portal data (mock data must never reach a public page)." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/auth/**", ...PORTAL_FILES],
    rules: { "no-restricted-imports": ["error", { patterns: [ADAPTERS] }] },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

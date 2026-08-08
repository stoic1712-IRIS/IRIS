import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/dist-types/**", "**/node_modules/**", "**/coverage/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.check.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["apps/visual-composer/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./apps/visual-composer/tsconfig.check.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.d.mts"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
    },
  },
  {
    files: ["**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
);

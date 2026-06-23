import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Recreate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  {
    ignores: ['dist', 'eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      // Note: You might want to remove or change 'commonjs' to 'module'
      // if your Turborepo packages are using modern ESM imports/exports
      sourceType: 'commonjs',
      parserOptions: {
        // 2. Explicitly set the root directory for resolving TS configs
        tsconfigRootDir: __dirname,
        // 3. Point to the TS configs relative to this root file
        project: ['./apps/*/tsconfig.json', './packages/*/tsconfig.json'],
      },
    },
  },
);



// // @ts-check
// import eslint from '@eslint/js';
// import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
// import globals from 'globals';
// import tseslint from 'typescript-eslint';

// export default tseslint.config(
//   {
//     ignores: ['eslint.config.mjs'],
//   },
//   eslint.configs.recommended,
//   ...tseslint.configs.recommendedTypeChecked,
//   eslintPluginPrettierRecommended,
//   {
//     languageOptions: {
//       globals: {
//         ...globals.node,
//         ...globals.jest,
//       },
//       sourceType: 'commonjs',
//       parserOptions: {
//         projectService: true,
//         tsconfigRootDir: import.meta.dirname,
//       },
//     },
//   },
//   {
//     rules: {
//       '@typescript-eslint/no-explicit-any': 'off',
//       '@typescript-eslint/no-floating-promises': 'warn',
//       '@typescript-eslint/no-unsafe-argument': 'warn',
//       "prettier/prettier": ["error", { endOfLine: "auto" }],
//     },
//   },
// );

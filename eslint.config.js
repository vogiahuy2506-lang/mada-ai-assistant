import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      'dist',
      'node_modules',
      'build',
      'coverage',
      'backend/**',
      'data/**',
      'docs/**',
      '*.config.js',
      '*.config.ts',
    ],
  },

  // Base JavaScript config
  js.configs.recommended,

  // TypeScript files
  ...tseslint.configs.recommended,

  // React hooks rules
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // Common rules
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'no-unused-vars': 'off', // Handled by TypeScript
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },

  // React files
  {
    files: ['**/*.{jsx,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: { attributes: false },
      }],
    },
  },

  // Server files (Node.js)
  {
    files: ['server/**/*.ts', 'src/lib/**/*.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-case-declarations': 'off',
      'prefer-const': 'off',
      'no-irregular-whitespace': 'off',
      'no-empty': 'off',
    },
  },
);

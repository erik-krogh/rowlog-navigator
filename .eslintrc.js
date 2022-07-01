module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
  ],
  ignorePatterns: ["test/sources/*", "work/"],
  rules: {
    // subjective list by @esbena
    "@typescript-eslint/no-this-alias": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/prefer-regexp-exec": "off",
    "@typescript-eslint/require-await": "off",
    "prefer-const": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/prefer-namespace-keyword": "off",
    "@typescript-eslint/no-namespace": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/restrict-plus-operands": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    "no-constant-condition": "off",
    "@typescript-eslint/unbound-method": "off",
    "@typescript-eslint/ban-types": "off",
    "@typescript-eslint/no-inferrable-types": "off",
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "prefer-rest-params": "off",
    "no-inner-declarations": "off",
    // required until exported-sarif-utils is rewritten in typescript
    "no-var": "off",
    // required until exported-sarif-utils is rewritten in typescript
    "@typescript-eslint/no-var-requires": "off",
    // required until exported-sarif-utils is rewritten in typescript
    "no-undef": "off",
  },
};

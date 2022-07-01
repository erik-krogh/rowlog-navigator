module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/qlpacks/",
    "<rootDir>/dist/",
    "<rootDir>/work/",
  ],
  modulePathIgnorePatterns: [
    "<rootDir>/dist/",
    "<rootDir>/qlpacks/",
    "<rootDir>/work/",
  ],
};

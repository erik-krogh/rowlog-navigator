import * as fs from "fs";
import * as path from "path";
import appRoot from "app-root-path";
import merge from "lodash.merge";

enum CONFIG_ENUM {
  USER_NAME = "username",
  PASSWORD = "password",
  SITE_ID = "rowclub ID", // ASR = 159
  ROW_NAV_SERVER = "url to external server saving and caching"
}

export type KEY_TYPE = keyof typeof CONFIG_ENUM;

export type Config = {
  [key in KEY_TYPE]: string;
};

export const CONFIG_KEYS: Array<keyof Config> = Object.keys(CONFIG_ENUM)
  .filter((e) => !(parseInt(e) >= 0))
  .map((e) => e as keyof Config);

export function getConfigDescription(key: KEY_TYPE) {
  return CONFIG_ENUM[key];
}

export function getConfigFilePath(): string {
  return path.join(appRoot.path, "config.json");
}

export function getConfig(): Partial<Config> {
  if (!fs.existsSync(getConfigFilePath())) {
    return {};
  }
  return JSON.parse(fs.readFileSync(getConfigFilePath(), "utf8"));
}

export function mergeConfig(config: Partial<Config>) {
  const newConfig = merge({}, getConfig(), config);
  fs.writeFileSync(getConfigFilePath(), JSON.stringify(newConfig, null, 2));
}

export function hasConfigFile() {
  return fs.existsSync(getConfigFilePath());
}

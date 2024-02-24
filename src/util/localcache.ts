import * as fs from "fs";
import * as path from "path";
import appRoot from "app-root-path";

export function ensureDirExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // the above should work on recent node, but in case it doesn't:
      let dirs = dir.split("/");
      for (let i = 0; i < dirs.length; i++) {
        dir = dirs.slice(0, i + 1).join("/");
        if (dir && !!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }
      }
    }
  }
}

/**
 * A very simple string-only cache.
 * The keys/values must not contain "=" or newlines.
 * The cache is initialized lazily.
 */
export default class Cache {
  private cache?: Map<string, string>;
  private getter: (key: string) => Promise<string>;
  constructor(private key: string, getter: (key: string) => Promise<string>) {
    // running at most 100 requests every second in an attempt to avoid secondary rate limits.
    this.getter = throttle(getter, 100, 10); // trying to get an even stream, by sending 10 every 100ms.
  }

  async get(key: string): Promise<string> {
    key = key.replace(/\n|=/g, "");
    if (this.cache && this.cache.has(key)) {
      return this.cache.get(key);
    }
    return await this.getFresh(key);
  }

  async getFresh(key: string): Promise<string> {
    key = key.replace(/\n|=/g, "");
    if (this.cache === undefined) {
      this.initCache();
    }
    const val = (await this.getter(key)).replace(/\n/g, "");
    this.cache.set(key, val);
    fs.appendFileSync(this.getCachePath(), `${key}=${val}\n`);
    return val;
  }

  getCacheKeys(): string[] {
    if (this.cache === undefined) {
      this.initCache();
    }
    return Array.from(this.cache.keys());
  }

  private getCachePath(): string {
    const dir = path.join(appRoot.path, "work-cache");
    return path.join(dir, this.key + ".cache");
  }

  initCache(): void {
    this.cache = new Map();
    const cachePath = this.getCachePath();
    if (!fs.existsSync(cachePath)) {
      ensureDirExists(path.dirname(cachePath));
      fs.writeFileSync(cachePath, "");
    }
    fs.readFileSync(cachePath)
      .toString()
      .trim()
      .split("\n")
      .forEach((line) => {
        if (line === "") {
          return;
        }
        const keyValue = line.split("=");
        this.cache.set(keyValue[0], keyValue.slice(1).join("="));
      });
  }
}

/**
 * Transforms a string => string function such that it is at most `parallism` invocations happens
 * every `wait` milliseconds.
 */
export function throttle(
  f: (key: string) => Promise<string>,
  wait: number,
  parallism: number
): (key: string) => Promise<string> {
  let queue: [string, (resolved: string) => void, (reject: any) => void][] = [];
  let lastInvocation: number | null = null;
  let parallismCounter = 0; // is reset every wait milliseconds
  let currentlyRunning = 0; // the actual number of running invocations
  return function run(key: string) {
    if (
      lastInvocation === null ||
      Date.now() - lastInvocation > wait ||
      parallismCounter < parallism
    ) {
      if (Date.now() - lastInvocation > wait) {
        parallismCounter = 0;
        lastInvocation = Date.now();
      }
      parallismCounter++;
      currentlyRunning++;
      return new Promise((resolve, reject) => {
        f(key)
          .then(resolve, reject)
          .finally(() => {
            parallismCounter--;
            currentlyRunning--;
            if (queue.length) {
              const next = queue.shift();
              run(next[0]).then(next[1]).catch(next[2]);
            }
          });
      });
    } else {
      if (currentlyRunning > 0) {
        return new Promise((resolve, reject) => {
          queue.push([key, resolve, reject]);
        });
      } else {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            run(key).then(resolve, reject);
          }, wait - (Date.now() - lastInvocation));
        });
      }
    }
  };
}

import * as prompt from "simple-cli-prompter";
import type * as api from "../api/rokort.js";
import colors from "ansi-colors";

export async function promptRower(ids?: number[]): Promise<api.Member> {
  const members = await (await import("../api/rokort.js")).members();
  const idSet = ids ? new Set(ids) : null;
  const rowerSelection = await prompt.ask(
    "Hvilken roer?",
    members
      .getAllMembers()
      .filter((m) => !idSet || idSet.has(m.id))
      .map((m) => {
        return {
          name: m.id + "",
          message: colors.bold(m.name) + " (" + m.id + ")",
        };
      })
  );
  return members.getMember(+rowerSelection);
}

let lastInvalidation: Date | undefined;
export function invalidateCaches() {
  lastInvalidation = new Date();
}

// cache a value for a specified number of seconds
export function cache<T>(getter: () => T, seconds: number) {
  let value: T | undefined;
  let expires: number | undefined;
  let lastRefresh: Date | undefined;
  return () => {
    if (lastInvalidation && (!lastRefresh || lastRefresh < lastInvalidation)) {
      value = undefined;
      expires = undefined;
      lastRefresh = undefined;
    }
    if (value != undefined && expires && expires > Date.now()) {
      return value;
    }
    value = getter();
    lastRefresh = new Date();
    expires = Date.now() + seconds * 1000;
    return value;
  };
}

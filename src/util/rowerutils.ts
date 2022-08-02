import * as prompt from "../prompt";
import * as api from "../api/api";
import * as colors from "ansi-colors";

export async function promptRower(ids?: number[]): Promise<api.Member> {
  const members = await api.members();
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

// cache a value for a specified number of seconds
export function cache<T>(getter: () => T, seconds: number) {
  let value: T | undefined;
  let expires: number | undefined;
  return () => {
    if (expires && expires > Date.now()) {
      return value;
    }
    value = getter();
    expires = Date.now() + seconds * 1000;
    return value;
  };
}

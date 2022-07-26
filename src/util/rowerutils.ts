import * as prompt from "../prompt";
import * as api from "../api/api";
import * as colors from "ansi-colors";

export async function promptRower(
  data: api.TripData
): Promise<api.RowerDetails> {
  const rowerSelection = await prompt.ask(
    "Hvilken roer?",
    data.getAllRowerIds().map((id) => {
      return {
        name: id + "",
        message:
          data.getRowerDetails(id).rowerName + colors.dim(" (" + id + ")"),
      };
    })
  );
  return data.getRowerDetails(Number(rowerSelection));
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

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

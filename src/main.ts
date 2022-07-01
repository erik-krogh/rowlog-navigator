import * as prompt from "./prompt";
import * as colors from "ansi-colors";
import * as api from "./api/api";
import * as eventFetcher from "./api/eventFetcher";
import * as config from "./util/config";

export async function run(): Promise<void> {
  console.log("Velkommen til " + colors.green.bold("Rokort stats!"));

  if (!config.hasConfigFile()) {
    config.mergeConfig({
      USER_NAME: await prompt.ask("Brugernavn"),
      PASSWORD: await prompt.ask("Kodeord"),
      SITE_ID: await prompt.ask("Site ID (ASR = 159)"),
    });
  }

  void api.trips(); // async fetching to speed up first request.
  void eventFetcher.saveCurrentEvents(); // saving current events, so we don't miss when they are deleted.

  let category = await prompt.ask("Hvad vil se?", [
    {
      name: "boat",
      message: "Båd statestik",
    },
    {
      name: "member-stats",
      message: "Roer statestik",
    },
    {
      name: "members",
      message: "Søge i medlemsdatabasen",
    },
    {
      name: "events",
      message: "Aktiviteter",
    },
  ]);

  switch (category) {
    case "boat":
      return await (await import("./cmds/boat")).run();
    case "member-stats":
      return await (await import("./cmds/memberStats")).run();
    case "members":
      return await (await import("./cmds/members")).run();
    case "events":
      return await (await import("./cmds/events")).run();
    default:
      throw new Error("Unknown answer");
  }
}

void run();

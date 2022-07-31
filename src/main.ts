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
  void eventFetcher.events(); // populating events cache.
  void api.members(); // populating members cache.

  return await mainPrompt();
}

void run();

export async function mainPrompt() {
  let category = await prompt.ask("Hvad vil du se?", [
    {
      name: "member-stats",
      message: "Roer statestik",
    },
    {
      name: "boat",
      message: "Båd statestik",
    },
    {
      name: "members",
      message: "Medlemsdatabasen",
    },
    {
      name: "events",
      message: "Aktiviteter",
    },
    {
      name: "quit",
      message: "Afslut",
    },
  ]);

  switch (category) {
    case "boat":
      return await (await import("./cmds/boat")).run();
    case "member-stats":
      return await (await import("./cmds/memberStats")).run();
    case "members":
      return await (await import("./cmds/members")).searchForMember();
    case "events":
      return await (await import("./cmds/events")).run();
    case "quit":
      return process.exit(0);
    default:
      throw new Error("Unknown answer");
  }
}

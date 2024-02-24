import * as prompt from "simple-cli-prompter";
import colors from "ansi-colors";
import * as config from "./util/config.js";
import { invalidateCaches } from "./util/rowerutils.js";
import * as fs from "fs";
import * as path from "path";
import appRoot from "app-root-path";
import * as currentSeason from "./util/currentSeason.js";

export async function run(): Promise<void> {
  console.log("Velkommen til " + colors.green.bold("Rokort stats!"));

  if (!config.hasConfigFile()) {
    config.mergeConfig({
      USER_NAME: await prompt.ask("Brugernavn"),
      PASSWORD: await prompt.ask("Kodeord"),
    });
  }

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
      name: "trips",
      message: "Roprotokolen",
    },
    {
      name: "the-board",
      message: "Statestik til bestyrelsen",
    },
    {
      name: "change-season",
      message: "Skift sæson",
      hint: "valgt: " + currentSeason.getCurrentSeason(),
    },
    {
      name: "clear-caches",
      message: "Tøm cache",
    },
    {
      name: "quit",
      message: "Afslut",
    },
  ]);

  switch (category) {
    case "boat":
      return await (await import("./cmds/boat.js")).run();
    case "member-stats":
      return await (await import("./cmds/memberStats.js")).run();
    case "members":
      return await (await import("./cmds/members.js")).run();
    case "trips":
      return await (await import("./cmds/trips.js")).run();
    case "the-board":
      return await (await import("./cmds/theBoard.js")).run();
    case "change-season":
      return await changeSeason();
    case "clear-caches":
      return await clearAllCaches();
    case "quit":
      return process.exit(0);
    default:
      throw new Error("Unknown answer");
  }
}

async function changeSeason(): Promise<void> {
  console.log("En sæson starter 1. november året før, og slutter 31. oktober.");
  const answer = await prompt.ask(
    "Vælg sæson",
    currentSeason.POSSIBLE_SEAONS.map((s) => ({
      name: s + "",
      message: s + "",
    }))
  );

  currentSeason.changeCurrentSeason(+answer);
  invalidateCaches();
  return await mainPrompt();
}

async function clearAllCaches(): Promise<void> {
  invalidateCaches();
  fs.unlinkSync(path.join(appRoot.path, "work-cache", "fetchTrips.cache"));
  return await mainPrompt();
}

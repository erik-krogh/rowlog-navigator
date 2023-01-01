import * as prompt from "./prompt";
import * as colors from "ansi-colors";
import * as api from "./api/api";
import * as eventFetcher from "./api/eventFetcher";
import * as config from "./util/config";
import { invalidateCaches } from "./util/rowerutils";
import * as fs from "fs";
import * as path from "path";
import appRoot from "app-root-path";


const POSSIBLE_SEAONS = [2021, 2022, 2023];
let selectedSeason = POSSIBLE_SEAONS[POSSIBLE_SEAONS.length - 1];

export function getCurrentSeason(): number {
  return selectedSeason;
}

export async function run(): Promise<void> {
  console.log("Velkommen til " + colors.green.bold("Rokort stats!"));

  if (!config.hasConfigFile()) {
    config.mergeConfig({
      USER_NAME: await prompt.ask("Brugernavn"),
      PASSWORD: await prompt.ask("Kodeord"),
      SITE_ID: await prompt.ask("Site ID (ASR = 159)"),
    });
  }

  populateCaches();

  return await mainPrompt();
}

function populateCaches() {
  void api.trips(); // async fetching to speed up first request.
  void eventFetcher.saveCurrentEvents(); // saving current events, so we don't miss when they are deleted.
  void eventFetcher.events(); // populating events cache.
  void api.members(); // populating members cache.
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
      name: "trips",
      message: "Roprotokolen",
    },
    {
      name: "change-season",
      message: "Skift sæson",
      hint: "valgt: " + selectedSeason,
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
      return await (await import("./cmds/boat")).run();
    case "member-stats":
      return await (await import("./cmds/memberStats")).run();
    case "members":
      return await (await import("./cmds/members")).searchForMember();
    case "events":
      return await (await import("./cmds/events")).run();
    case "trips":
      return await (await import("./cmds/trips")).run();
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
    POSSIBLE_SEAONS.map((s) => ({
      name: s + "",
      message: s + "",
    }))
  );

  selectedSeason = +answer;
  invalidateCaches();
  populateCaches();
  return await mainPrompt();
}

async function clearAllCaches(): Promise<void> {
  invalidateCaches();
  fs.unlinkSync(path.join(appRoot.path, "work-cache", "fetchTrips.cache"));
  populateCaches();
  return await mainPrompt();
}
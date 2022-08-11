import got from "got";
import * as cherrio from "cheerio";
import appRoot from "app-root-path";
import * as path from "path";
import * as fs from "fs";
import { cache } from "../util/rowerutils";
import { getConfig } from "../util/config";
import { auth } from "./api";

export type Event = {
  eventId: number;
  name: string;
  description?: string;
  creator: string; // the name of the creator
  route: string;
  start: Date;
  end: Date;
  lastResp: Date;
  distance?: number;
  current: boolean;
  participants: {
    memberName: string;
    comment: string;
    signedUp: Date;
    cancelled?: boolean;
  }[];
};

async function fetchCurrentEvents(): Promise<Event[]> {
  // a fresh PHPSESSID
  const url = "http://rokort.dk/";
  const sessionID = await got(url).then(
    (res) => res.headers["set-cookie"][0].split(";")[0].split("=")[1]
  );

  const config = getConfig();

  // login
  const request = await got.post("http://rokort.dk/index.php", {
    headers: {
      Cookie: `PHPSESSID=${sessionID}`,
    },
    form: {
      user_name: config.USER_NAME,
      password: config.PASSWORD,
      action: "login",
      siteid: config.SITE_ID,
      save_login: "1",
      page: "",
    },
  });

  if (request.body.includes("Forkert brugernavn eller kodeord")) {
    throw new Error("Forkert brugernavn eller kodeord");
  }

  // fetch list of upcoming events
  const html = await got("http://rokort.dk/workshop/workshop2.php", {
    headers: {
      Cookie: `PHPSESSID=${sessionID}`,
    },
  }).then((res) => res.body);

  // get the onclick attribute from each "#events_scroll tr"
  const $ = cherrio.load(html);
  const onclick = $("#events_scroll tr")
    .map((i, el) => {
      return $(el).attr("onclick");
    })
    .get();

  // "showWin('event.php?id=1017');" -> 1017
  const eventIDs = onclick.map((el) => Number(el.split("'")[1].split("=")[1]));

  const eventHTMLs = await Promise.all(
    eventIDs.map((id) =>
      got(`http://rokort.dk/workshop/event.php?id=${id}`, {
        headers: {
          Cookie: `PHPSESSID=${sessionID}`,
        },
      }).then((res) => [id, res.body] as [number, string])
    )
  );

  const events = eventHTMLs.map(([id, html]) => {
    const $ = cherrio.load(html);

    const metaData: Map<string, string> = new Map();
    $("table.input_table tr")
      .get()
      .map((el) => {
        // key -> tr > td:nth-child(0)
        const key = $(el).children().first().text().trim();
        // value -> tr > td:nth-child(1)
        const value = $(el).children().first().next().text().trim();
        metaData.set(key, value);
      });

    const participants = $("table.box_borders tr:not(:first-child)")
      .map((i, el) => {
        // name | comment | signed up | id
        let [rawName, comment, signedUp] = $(el)
          .find("td")
          .map((i, el) => $(el).text().trim())
          .get();
        const name = rawName.split("(")[0].trim();
        return {
          memberName: name,
          comment,
          signedUp: parseRowDate(signedUp),
        };
      })
      .get();

    const event: Event = {
      eventId: id,
      name: $("h1").text().trim(),
      description: $("h1 + div")
        .html()
        ?.replace(/\n/g, "")
        .replace(/<br>/g, "\n"),
      creator: metaData.get("Kontaktperson"),
      route: metaData.get("Rute"),
      start: parseRowDate(metaData.get("Start")),
      end: parseRowDate(metaData.get("Slut")),
      lastResp: parseRowDate(metaData.get("Sidste tilmelding")),
      distance: metaData.get("Kilometer")
        ? Number(metaData.get("Kilometer"))
        : undefined,
      participants,
      current: true,
    };
    return event;
  });

  return events;
}

function parseRowDate(raw: string): Date {
  if (!raw) {
    return new Date(0);
  }
  // 26-07-2022 15:00 -> 2022-07-26T15:00:00.000Z
  const [date, time] = raw.split(" ");
  const [day, month, year] = date.split("-");
  const [hour, minute] = time.split(":");
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0
  );
}

const cacheFolder = path.join(appRoot.path, "work-cache", "events");
// cached for an hour.
export const events = cache<Promise<Event[]>>(async () => {
  const config = getConfig();

  // If the server is configured, then try to use it.
  if (config.ROW_NAV_SERVER) {
    const resp = await got.get(config.ROW_NAV_SERVER + "/events", {
      headers: { Authorization: "Basic " + auth() },
    });

    // and get the local cache up to date anyway
    void saveCurrentEvents();

    const events: Event[] = JSON.parse(resp.body);
    // dates are stringified in JSON, so we need to parse them.
    for (const event of events) {
      event.start = new Date(event.start);
      event.end = new Date(event.end);
      event.lastResp = new Date(event.lastResp);
      event.participants.forEach((p) => {
        p.signedUp = new Date(p.signedUp);
      });
    }
    return events;
  }

  // else, do it locally.
  const currentEventsIds = await saveCurrentEvents();
  const res: Event[] = [];
  for (const file of fs.readdirSync(cacheFolder)) {
    const event = JSON.parse(
      fs.readFileSync(path.join(cacheFolder, file), "utf8")
    );
    event.current = currentEventsIds.has(event.eventId);
    res.push(event);
  }

  return res;
}, 60 * 60);

export async function saveCurrentEvents() {
  const currentEvents = await fetchCurrentEvents();

  fs.mkdirSync(cacheFolder, { recursive: true });

  saveEvents(currentEvents, cacheFolder);

  const currentEventsIds = new Set(currentEvents.map((c) => c.eventId));
  return currentEventsIds;
}

function saveEvents(events: Event[], folder: string) {
  for (const event of events) {
    const file = path.join(folder, `${event.eventId}.json`);
    if (fs.existsSync(file)) {
      // find old participants not in the new, add them and mark them as cancelled
      const newParticipantNames = new Set(
        event.participants.map((p) => p.memberName)
      );
      for (const oldParticipant of JSON.parse(fs.readFileSync(file, "utf8"))
        .participants) {
        if (!newParticipantNames.has(oldParticipant.memberName)) {
          oldParticipant.cancelled = true;
          event.participants.push(oldParticipant);
        }
      }
    }

    fs.writeFileSync(file, JSON.stringify(event, null, 2));
  }
}

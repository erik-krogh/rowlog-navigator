import { cache } from "../util/rowerutils";
import * as eventFetcher from "../api/eventFetcher";

import * as ics from "ics";

// TODO: Handle cancelled events
export const icsExport = cache<Promise<string>>(async () => {
  console.log("Fetching events... " + new Date());
  const events = await eventFetcher.events();
  const cal = ics.createEvents(
    events
      // .filter((e) => e.current) // TODO comment in?
      .filter((e) => e.start && e.end)
      .filter((e) => !e.cancelled)
      .map((e): ics.EventAttributes => {
        try {
          return {
            classification: "PUBLIC",
            title: e.name,
            start: dateToDateArray(e.start),
            duration: {
              seconds: (e.end.getTime() - e.start.getTime()) / 1000,
            },
            description: writeDescription(e),
          };
        } catch (err) {
          console.log(JSON.stringify(e, null, 2));
          throw err;
        }
      })
  );
  if (cal.error) {
    console.error(cal.error);
    throw cal.error;
  } else {
    return addTimeZone(cal.value);
  }
}, 60 * 60);

function writeDescription(e: eventFetcher.Event): string {
  const url = "https://rokort.dk/index.php?page=event," + e.eventId;

  let res = (e.description || "").trim();
  res += "\n\n";
  res += url + "\n";
  if (e.route) {
    res += "Rute: " + e.route + " (" + e.distance + "km)\n";
  }
  res += e.participants.filter((e) => !e.cancelled).length + " deltagere\n";

  return res;
}

// in UTC
function dateToDateArray(d: Date): ics.DateArray {
  // [number, number, number, number, number]
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}

function addTimeZone(ical: string): string {
  return ical.replace(/DTSTART:/g, "DTSTART;TZID=Europe/Copenhagen:");
}

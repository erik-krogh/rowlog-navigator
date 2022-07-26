import { cache } from "../util/rowerutils";
import * as eventFetcher from "../api/eventFetcher";
import * as api from "../api/api";

import * as ics from "ics";

export const icsAcitivitesExport = cache<Promise<string>>(async () => {
  const events = await eventFetcher.events();
  const cal = ics.createEvents(
    events
      // .filter((e) => e.current) // Comment this in to only export current events
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
    return cal.value;
  }
}, 60 * 60);

function writeDescription(e: eventFetcher.Event): string {
  const url = "https://rokort.dk/index.php?page=event," + e.eventId;

  let res = (e.description || "").trim();
  res += "\n\n";
  res += url + "\n";
  if (e.route) {
    res +=
      "Rute: " + e.route + (e.distance ? " (" + e.distance + "km)" : "") + "\n";
  }
  res += e.participants.filter((e) => !e.cancelled).length + " deltagere\n";

  return res;
}

// in UTC
function dateToDateArray(d: Date): ics.DateArray {
  d = new Date(d.getTime() - copenhagenOffset(d));
  // [number, number, number, number, number]
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}

function copenhagenOffset(d: Date): number {
  function convertTZ(date: Date, tzString: string) {
    return new Date(date.toLocaleString("en-US", { timeZone: tzString }));
  }

  return (
    convertTZ(d, "Europe/Copenhagen").getTime() - convertTZ(d, "UTC").getTime()
  );
}

export const icsProtocolExport = cache<Promise<string>>(async () => {
  const trips = (await api.trips()).getTrips();
  const cal = ics.createEvents(
    trips.map((t): ics.EventAttributes => {
      return {
        classification: "PUBLIC",
        title: t.description,
        start: dateToDateArray(t.startDateTime),
        duration: {
          seconds: (t.endDateTime.getTime() - t.startDateTime.getTime()) / 1000,
        },
        description: t.distance + "km\n" + t.participants.length + " deltagere",
      };
    })
  );

  if (cal.error) {
    console.error(cal.error);
    throw cal.error;
  } else {
    return cal.value;
  }
}, 60 * 60);

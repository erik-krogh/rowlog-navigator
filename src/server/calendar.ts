import { cache } from "../util/rowerutils";
import * as eventFetcher from "../api/eventFetcher";

import * as ics from "ics";

// TODO: Handle cancelled events
export const icsExport = cache<Promise<string>>(async () => {
  const events = await eventFetcher.events();
  console.log(events.length + " events found.");
  console.log(events.filter((e) => e.current).length + " events are current.");
  const cal = ics.createEvents(
    events
      // .filter((e) => e.current) // TODO comment in?
      .filter((e) => e.start && e.end)
      .filter((e) => !e.cancelled)
      .map((e): ics.EventAttributes => {
        console.log(JSON.stringify(e, null, 2));
        const url = "https://rokort.dk/index.php?page=event," + e.eventId;
        try {
          return {
            classification: "PUBLIC",
            title: e.name,
            start: dateToDateArray(e.start),
            startInputType: "local",
            startOutputType: "local",
            duration: {
              seconds: (e.end.getTime() - e.start.getTime()) / 1000,
            },
            description: (e.description || "").trim() + "\n\n" + url,
            url,
            busyStatus: "FREE",
            organizer: { name: e.creator, email: "dummy@example.org" },
            attendees: e.participants
              .filter((p) => !p.cancelled)
              .map((p) => {
                return {
                  name: p.memberName,
                  rsvp: true,
                  partstat: "ACCEPTED",
                  role: "OPT-PARTICIPANT",
                  email: "dummy@example.org",
                };
              }),
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

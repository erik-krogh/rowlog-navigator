// a server that constantly refreshes the cache of activities.
import express from "express";
import * as eventFetcher from "./api/eventFetcher";
import * as api from "./api/api";
import type * as ExpressStatic from "express-serve-static-core";

(function cache() {
  console.log("Refreshing cache...");
  void eventFetcher.events();
  setTimeout(cache, 60 * 1000); // every minute is fine, because they cache is kept for an hour anyway.
})();

// start the server
const app = express();

const requestLogin = async (
  req: ExpressStatic.Request,
  res: ExpressStatic.Response,
  next: ExpressStatic.NextFunction
) => {
  if (!req.headers || !req.headers.authorization) {
    res.status(401).send("Unauthorized");
    return;
  }
  const authHeader = req.headers.authorization;
  if (authHeader.toLowerCase() !== ("Basic " + api.auth()).toLowerCase()) {
    res.status(401).send("Unauthorized");
    return next(new Error("Not authorized! Go back!"));
  } else {
    return next();
  }
};

app.get("/events", requestLogin, (req, res) => {
  console.log("Fetching events...");
  eventFetcher
    .events()
    .then((events) => {
      res.status(200).json(events);
    })
    .catch((e) => {
      console.error(e);
      res.status(500).send(e.message);
    });
});

import * as ics from "ics";
// TODO: Cache! The timezones are off. Move into separate file.
app.get(/events\d*\.ics/, async (req, res) => {
  try {
    const events = await eventFetcher.events();
    console.log(events.length + " events found.");
    console.log(
      events.filter((e) => e.current).length + " events are current."
    );
    const cal = ics.createEvents(
      events
        .filter((e) => e.current)
        .filter((e) => e.start && e.end)
        .map((e) => ({
          ...e,
          start: new Date(e.start),
          end: new Date(e.end), // TODO: Should be converted before!
        }))
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
              description: e.description.trim() + "\n\n" + url,
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
      res.status(500).send(cal.error);
    } else {
      res.type("ics");
      res.status(200).send(addTimeZone(cal.value));
    }
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});
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

// start the server
const port = process.env.PORT || 9001;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

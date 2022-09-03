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
app.get("/events.ics", async (req, res) => {
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
          end: new Date(e.end),
        }))
        .map((e) => {
          console.log(JSON.stringify(e, null, 2));
          try {
            return {
              class: "PUBLIC",
              title: e.name,
              start: dateToDateArray(new Date(e.start)),
              duration: {
                seconds: (e.end.getTime() - e.start.getTime()) / 1000,
              },
              description: e.description,
              url: "https://rokort.dk/index.php?page=event," + e.eventId,
              busyStatus: "FREE",
              organizer: { name: e.creator },
              attendees: e.participants
                .filter((p) => !p.cancelled)
                .map((p) => {
                  return {
                    name: p.memberName,
                    rsvp: true,
                    partstat: "ACCEPTED",
                    role: "OPT-PARTICIPANT",
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
      res.status(200).send(cal.value);
    }
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

function dateToDateArray(d: Date): ics.DateArray {
  // [number, number, number, number, number]
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
  ];
}

// start the server
const port = process.env.PORT || 9001;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

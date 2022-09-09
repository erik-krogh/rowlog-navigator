// a server that constantly refreshes the cache of activities.
import express from "express";
import * as eventFetcher from "./api/eventFetcher";
import * as api from "./api/api";
import type * as ExpressStatic from "express-serve-static-core";

(function cache() {
  void eventFetcher.events();
  setTimeout(cache, 60 * 60 * 1000); // refresh every hour
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

import { icsAcitivitesExport, icsProtocolExport } from "./server/calendar";

app.get(/events\d*\.ics/, async (req, res) => {
  console.log("Someone requested the calendar (" + req.url + ") " + new Date());
  try {
    res.type("text/calendar");
    res.status(200).send(await icsAcitivitesExport());
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

app.get(/protocol\d*\.ics/, async (req, res) => {
  console.log("Someone requested the protocol (" + req.url + ") " + new Date());
  return res.status(401).send("Unauthorized"); // This was only an experiment, not intended to be used
  try {
    res.type("text/calendar");
    res.status(200).send(await icsProtocolExport());
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
});

// start the server
const port = process.env.PORT || 9001;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

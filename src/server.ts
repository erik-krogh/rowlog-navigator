// a server that constantly refreshes the cache of activities.
import express from "express";
import * as eventFetcher from "./api/eventFetcher";
import { auth } from "./api/api";

setInterval(() => {
  console.log("Refreshing cache...");
  eventFetcher.saveCurrentEvents();
}, 60 * 60 * 1000);

// start the server
const app = express();

app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader.toLowerCase() !== ("Basic " + auth()).toLowerCase()) {
    res.status(401).end();
    return next(new Error("Not authorized! Go back!"));
  } else {
    return next();
  }
});

app.get("/events", async (req, res) => {
  console.log("Fetching events...");
  const events = await eventFetcher.events();
  res.status(200).json(events);
});

// start the server
const port = process.env.PORT || 9001;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

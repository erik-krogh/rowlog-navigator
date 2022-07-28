// a server that constantly refreshes the cache of activities.
import express from "express";

import * as eventFetcher from "./api/eventFetcher";

setInterval(() => {
  console.log("Refreshing cache...");
  eventFetcher.saveCurrentEvents();
}, 60 * 60 * 1000);

// start the server
const app = express();
app.get("/events", async (req, res) => {
  const events = await eventFetcher.events();
  res.status(200).json(events);
});

// start the server
const port = process.env.PORT || 9001;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
// a server that constantly refreshes the cache of activities.
import express from "express";
import * as api from "./api/newApi";
import type * as ExpressStatic from "express-serve-static-core";
import * as util from "./util/rowerutils";

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

app.get("/events", requestLogin, (_req, res) => {
  console.log("Fetching events...");
  res.status(500).end("Not implemented");
});

const permissionMap = {
  "Coastal": "Cx",
  "Friroet": "R",
  "Roret": "R",
  "Instruktør": "I",
  "Instruktør Sculler": "IS",
  "K1": "K1",
  "K2": "K2",
  "K3": "K3",
  "Kortturs styrmand": "K1",
  "Langturs styrmand": "L",
  "Langturstyrmand": "L",
  "S": "S",
  "S1": "S1",
  "S2": "S2",
  "Svømmeprøve": "SW",
  "Vinterstyrmandsret": "V",
}

const allPermissions = util.cache(
  async () => {
    const members = await api.members();
    const permissions: Record<string, string> = {};
    const tags = await api.tags();
    for (const member of members.getAllMembers()) {
      console.log(JSON.stringify(member, null, 2));
      let perms = member.permissions.map((p) => {
        const tag = tags[p];
        return permissionMap[tag.name.trim() as keyof typeof permissionMap] || null;
      }).filter((p) => p !== null);

      // dedup
      perms = [...new Set(perms)];

      permissions[member.name] = perms.join("");
    }
    return permissions;
  }, 60 * 60);


app.post("/permissions", async (req, res) => {
  // the request body contains a JSON array of names, and we respond with a corresponding JSON array of permissions.
  let data = "";
  req.on("data", (chunk) => {
    console.log("Got data: " + chunk);
    data += chunk;
  });
  req.on("end", async () => {
    console.log("No more data");
    let names = JSON.parse(data) as string[];
    const allPerms = await allPermissions();
    // remove duplicate spaces in the names
    names = names.map((n) => n.replace(/\s+/g, " ").trim());

    const result : string[] = names.map((n) => allPerms[n] || "");
    res.status(200).send(JSON.stringify(result));
  });
});

// import { icsAcitivitesExport, icsProtocolExport } from "./server/calendar";

app.get(/events\d*\.ics/, async (req, res) => {
  console.log("Someone requested the calendar (" + req.url + ") " + new Date());
  // TODO: Get events working.
  /* try {
    res.type("text/calendar");
    res.status(200).send(await icsAcitivitesExport());
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  } */
});

// start the server
const port = process.env.PORT || 9001;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

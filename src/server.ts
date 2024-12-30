// a server that constantly refreshes the cache of activities.
import express from "express";
import * as api from "./api/rokort.js";
import type * as ExpressStatic from "express-serve-static-core";
import * as util from "./util/rowerutils.js";
import https from "https";
import http from "http";
import fs from "fs";

// start the server
const app = express();

app.use(express.static("public", { dotfiles: "allow" }));

const requestLogin = (
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

import { permissionMap } from "./cmds/members.js";

const allPermissions = util.cache(async () => {
  const members = await api.members();
  const permissions: Record<string, string> = {};
  const tags = await api.tags();
  for (const member of members.getAllMembers()) {
    let perms = member.permissions
      .map((p) => {
        const tag = tags[p];
        if (!tag) {
          console.log("Unknown tag: " + p);
          return null;
        }
        return (
          permissionMap[tag.name.trim() as keyof typeof permissionMap] || null
        );
      })
      .filter((p) => p !== null);

    // dedup
    perms = [...new Set(perms)];

    permissions[member.name] = perms.join("");
  }
  return permissions;
}, 60 * 60);

app.post("/permissions", (req, res) => {
  // the request body contains a JSON array of names, and we respond with a corresponding JSON array of permissions.
  let data = "";
  req.on("data", (chunk) => {
    console.log("Got data: " + chunk);
    data += chunk;
  });

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  req.on("end", async () => {
    let names = JSON.parse(data) as string[];
    const allPerms = await allPermissions();
    // remove duplicate spaces in the names
    names = names.map((n) => n.replace(/\s+/g, " ").trim());

    const result: string[] = names.map((n) => allPerms[n] || "");
    console.log("Referring to: \"" + req.headers.referer + "\"");
    res.header("Access-Control-Allow-Origin", req.headers.referer);
    res.status(200).send(JSON.stringify(result));
  });
});

// Certificate
const privateKey = fs.readFileSync(
  "/etc/letsencrypt/live/asr1.webbies.dk/privkey.pem",
  "utf8"
);
const certificate = fs.readFileSync(
  "/etc/letsencrypt/live/asr1.webbies.dk/cert.pem",
  "utf8"
);
const ca = fs.readFileSync(
  "/etc/letsencrypt/live/asr1.webbies.dk/chain.pem",
  "utf8"
);

const credentials = {
  key: privateKey,
  cert: certificate,
  ca: ca,
};

import API from "./server/api.js";

// Mount the API router at /api/ endpoints
app.use("/api", API);

// start the server
https.createServer(credentials, app).listen(9001, () => {
  console.log("server is runing at port 9001");
});

https.createServer(credentials, app).listen(443, () => {
  console.log("server is runing at port 443");
});

http.createServer(app).listen(80, () => {
  console.log("plaintext server is runing at port 80");
});

/*
Certificate renewal:
$ sudo certbot certonly --manual
asr1.webbies.dk

run through the steps.

`certbot renew` is run with crontab (sudo crontab -e), so everything should just work.

*/

import * as prompt from "../prompt";
import * as api from "../api/api";
import * as eventFetcher from "../api/eventFetcher";
import * as colors from "ansi-colors";

export async function run() {
  const answer = await prompt.ask("Hvad vil du med aktiviteter?", [
    {
      name: "search",
      message: "Søg i aktiviteter",
    },
    {
      name: "most-created",
      message: "Hvem har oprettet flest aktiviteter",
    },
    {
      name: "most-participated",
      message: "Hvem har deltaget i flest aktiviteter",
    },
  ]);

  switch (answer) {
    case "search":
      return await search();
    case "most-created":
      return await mostCreated();
    case "most-participated":
      return await mostParticipated();
    default:
      throw new Error("Unknown answer");
  }
}

async function search() {
  const events = (await eventFetcher.events()).sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );
  const members = await api.members();
  const eventSelection = await prompt.ask(
    "Select event",
    events.map((e) => {
      return {
        name: e.eventId + "",
        message: e.name,
        hint:
          e.creator +
          " | " +
          e.route +
          " | " +
          e.participants.length +
          " deltagere",
      };
    })
  );
  const event = events.find((e) => e.eventId === +eventSelection);
  console.log(colors.bold(event.name));
  console.log("Lavet af " + event.creator);
  console.log(event.description);
  console.log("");
  console.log("Deltagere:");
  event.participants.forEach((p) => {
    console.log(
      p.memberName +
        " (" +
        members.getMemberByName(p.memberName).id +
        ") | " +
        p.comment +
        (p.cancelled ? " | Afmeldt!" : "")
    );
  });
}

async function mostCreated() {
  const events = await eventFetcher.events();
  const members = await api.members();
  const createCount: Map<string, number> = new Map(); // memberName -> count
  for (const event of events) {
    createCount.set(event.creator, (createCount.get(event.creator) || 0) + 1);
  }
  const sorted = Array.from(createCount.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([name, count]) => {
    console.log(
      name +
        " (" +
        members.getMemberByName(name).id +
        ") | " +
        count +
        " aktiviteter"
    );
  });
}

async function mostParticipated() {
  const events = await eventFetcher.events();
  const members = await api.members();
  const participantCount: Map<string, number> = new Map(); // memberName -> count
  for (const event of events) {
    event.participants.forEach((p) => {
      participantCount.set(
        p.memberName,
        (participantCount.get(p.memberName) || 0) + 1
      );
    });
  }
  const sorted = Array.from(participantCount.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  sorted.forEach(([name, count]) => {
    console.log(
      name +
        " (" +
        members.getMemberByName(name).id +
        ") | " +
        count +
        " aktiviteter"
    );
  });
}

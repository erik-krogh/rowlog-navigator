import * as prompt from "../prompt";
import * as api from "../api/api";
import * as eventFetcher from "../api/eventFetcher";
import * as colors from "ansi-colors";
import { promptRower } from "../util/rowerutils";

export async function run(): Promise<void> {
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
    {
      name: "events-for-member",
      message: "Se hvilke aktiviteter en roer har deltaget i",
    },
    {
      name: "find-potential-long-trip",
      message: "Find ture der måske burde være registreret som langture",
    },
    {
      name: "back",
      message: "Tilbage",
    },
  ]);

  switch (answer) {
    case "search":
      return await search();
    case "most-created":
      return await mostCreated();
    case "most-participated":
      return await mostParticipated();
    case "events-for-member":
      return await eventsForMember();
    case "back":
      return await (await import("../main")).mainPrompt();
    default:
      throw new Error("Unknown answer");
  }
}

async function search() {
  const events = (await eventFetcher.events()).sort((a, b) => {
    if (a.current != b.current) {
      return a.current ? -1 : 1;
    }
    return a.start.getTime() - b.start.getTime();
  });
  const members = await api.members();
  const eventSelection = await prompt.ask(
    "Select event",
    events.map((e) => {
      return {
        name: e.eventId + "",
        message: e.current ? colors.bold(e.name) : e.name,
        hint:
          e.creator +
          " | " +
          e.route +
          " | " +
          e.participants.filter((p) => !p.cancelled).length +
          " deltagere " +
          e.start.toLocaleDateString() +
          " " +
          e.start.getHours() +
          ":" +
          e.start.getMinutes(),
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
    const effect = p.cancelled ? colors.dim : colors.white;
    console.log(
      effect(
        p.memberName +
          " (" +
          members.getMemberByName(p.memberName).id +
          ") | " +
          members.getMemberByName(p.memberName).email +
          " | " +
          p.comment +
          (p.cancelled ? " | Afmeldt!" : "")
      )
    );
  });

  return await run();
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

  return await run();
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

  return await run();
}

async function eventsForMember() {
  const events = await eventFetcher.events();
  const members = await api.members();
  const allEventParticipants = events
    .flatMap((e) => e.participants)
    .map((p) => p.memberName)
    .map((m) => members.getMemberByName(m))
    .map((m) => m.id)
    .sort()
    // unique, check the previous one
    .filter((id, i, arr) => id !== arr[i - 1]);
  const rower = await promptRower(allEventParticipants);
  for (const event of events) {
    if (
      event.participants
        .map((p) => members.getMemberByName(p.memberName))
        .some((p) => p.id === rower.id)
    ) {
      console.log(
        event.name +
          " | " +
          event.route +
          " | " +
          event.start.toLocaleDateString() // TODO; Format better, this is US-only
      );
    }
  }

  return await run();
}

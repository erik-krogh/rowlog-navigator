import * as prompt from "simple-cli-prompter";
import * as api from "../api/rokort.js";
import { promptRower } from "../util/rowerutils.js";
import colors from "ansi-colors";
import { toPrettyDate } from "./members.js";

export async function run(): Promise<void> {
  const answer = await prompt.ask("Hvilken statestik?", [
    {
      name: "partners",
      message: "Givet en roer, hvem har vedkommende roet mest med?",
    },
    {
      name: "most-common",
      message: "Hvilke par af roere har roet mest med hinanden?",
    },
    {
      name: "community",
      message: "Hvem har roet med flest andre roere?",
    },
    {
      name: "tours",
      message: "Print de seneste ture",
    },
    {
      name: "distance",
      message: "Hvem har roet mest",
    },
    {
      name: "back",
      message: "Tilbage",
    },
  ]);

  switch (answer) {
    case "partners":
      return await partners(await api.trips());
    case "most-common":
      return await mostCommon(await api.trips());
    case "community":
      return await community(await api.trips());
    case "tours":
      return await tours(await api.trips());
    case "distance":
      return await distance(await api.trips());
    case "back":
      return await (await import("../main.js")).mainPrompt();
    default:
      throw new Error("Unknown answer");
  }
}

async function community(data: api.TripData): Promise<void> {
  const rowers = new Map<number, Set<number>>(); // rower -> set of rowers

  data.getTrips().forEach((trip) => {
    for (let i = 0; i < trip.participants.length; i++) {
      for (let j = 0; j < trip.participants.length; j++) {
        const p1 = trip.participants[i];
        const p2 = trip.participants[j];

        const key = p1.id;
        if (!key) {
          continue; // guest
        }
        rowers.set(key, rowers.get(key) || new Set());
        rowers.get(key).add(p2.id);
      }
    }
  });

  const members = await api.members();

  const isRabbit = (id: number) => {
    if (id === 0) {
      return false; // guest TODO: Doesn't happen anymore?
    }
    const member = members.getMember(id);
    return members.isRabbit(member);
  };

  // sort and print
  const sorted = Array.from(rowers.entries()).sort(
    (a, b) => b[1].size - a[1].size,
  );

  sorted.forEach(([id, rowers]) => {
    console.log(
      `${members.getMember(id).name} (${id}) har roet med ${
        rowers.size
      } andre roere, heraf ${
        Array.from(rowers).filter(isRabbit).length
      } kaniner`,
    );
  });

  return await run();
}

async function mostCommon(data: api.TripData): Promise<void> {
  const partners = new Map<string, number>(); // rower1|rower2 -> shared distance
  for (const trip of data.getTrips()) {
    for (let i = 0; i < trip.participants.length; i++) {
      for (let j = 0; j < trip.participants.length; j++) {
        const p1 = trip.participants[i];
        const p2 = trip.participants[j];
        if (p2.id >= p1.id) {
          continue; // Only count each pair once.
        }

        if (!p1.id || !p2.id) {
          // TODO: Doesn't happen anymore?
          continue; // guest
        }

        const key = p1.id + "|" + p2.id;
        partners.set(key, (partners.get(key) || 0) + trip.distance);
      }
    }
  }

  // sort and print
  const sorted = Array.from(partners.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100); // limit to 100

  const members = await api.members();

  sorted.forEach(([key, distance]) => {
    const [rower1, rower2] = key.split("|");
    const rower1Details = members.getMember(+rower1);
    const rower2Details = members.getMember(+rower2);
    console.log(
      `${rower1Details.name} (${rower1}) og ${rower2Details.name} (${rower2}) har roet ${distance} km`,
    );
  });

  return await run();
}

async function partners(data: api.TripData): Promise<void> {
  const rower = await promptRower(data.getAllRowerIds());

  const partners = new Map<number, number>(); // rowserId -> shared distance
  data.getAllTripsForRower(rower.id).forEach((trip) => {
    trip.participants.forEach((participant) => {
      if (!participant.id) {
        return; // guest
      }

      if (participant.id !== rower.id) {
        partners.set(
          participant.id,
          (partners.get(participant.id) || 0) + trip.distance,
        );
      }
    });
  });

  const members = await api.members();

  // sort and print
  const sorted = Array.from(partners.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, distance]) => {
    console.log(
      members.getMember(id).name + " (" + id + ") | " + +distance + " km",
    );
  });

  return await run();
}

async function tours(data: api.TripData) {
  const members = await api.members();

  const rawAnswer = await prompt.ask(
    "Søg efter et medlem",
    members.getAllMembers().map((member) => {
      return {
        name: member.id + "",
        message: member.name + colors.dim(" (" + member.id + ")"),
        hint: member.email,
      };
    }),
  );

  const member = members.getMember(Number(rawAnswer));

  for (const trip of data.getAllTripsForRower(member.id)) {
    const date = trip.startDateTime;
    const dist = trip.distance;
    const participants = trip.participants.length;
    const pDate = toPrettyDate(date);
    console.log(`${pDate}\t${dist}\t${participants}\t${trip.description}`);
  }

  return await run();
}

async function distance(data: api.TripData) {
  const onlyLongTripRaw = await prompt.ask("Kun langture?", ["Nej", "Ja"]);

  const onlyLongTrip = onlyLongTripRaw === "Ja";

  const members = await api.members();

  const distMap = new Map<number, number>(); // rowerId -> distance

  data.getTrips().forEach((trip) => {
    trip.participants.forEach((participant) => {
      if (!participant.id) {
        return; // guest
      }

      if (onlyLongTrip && !trip.longtrip) {
        return;
      }

      distMap.set(
        participant.id,
        (distMap.get(participant.id) || 0) + trip.distance,
      );
    });
  });

  // sort and print
  const sorted = Array.from(distMap.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, distance]) => {
    console.log(members.getMember(id).name + "\t" + id + "\t" + +distance + "\t" + members.getMember(id).email);
  });

  return await run();
}

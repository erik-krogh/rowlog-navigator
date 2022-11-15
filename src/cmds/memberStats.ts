import * as prompt from "../prompt";
import * as api from "../api/api";
import { promptRower } from "../util/rowerutils";

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
      name: "most-time",
      message: "Hvem har roet flest timer?",
    },
    {
      name: "kanin",
      message: "Hvor mange kilometer har kaninerne roet?"
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
    case "kanin":
      return await rabbit(await api.trips());
    case "most-time":
      return await mostTime(await api.trips());
    case "back":
      return await (await import("../main")).mainPrompt();
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

        const key = p1.memberId;
        if (!key) {
          continue; // guest
        }
        rowers.set(key, rowers.get(key) || new Set());
        rowers.get(key).add(p2.memberId);
      }
    }
  });

  const isRabbit = (id: number) => {
    // if the first two digits are the current year, it's a rabbit
    return id.toString().startsWith(new Date().getFullYear().toString().substring(2));
  }

  // sort and print
  const sorted = Array.from(rowers.entries()).sort(
    (a, b) => b[1].size - a[1].size
  );
  sorted.forEach(([id, rowers]) => {
    console.log(
      `${data.getRowerDetails(id).rowerName} (${id}) har roet med ${
        rowers.size
      } andre roere, heraf ${Array.from(rowers).filter(isRabbit).length} kaniner`
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
        if (p2.memberId >= p1.memberId) {
          continue; // Only count each pair once.
        }

        if (!p1.memberId || !p2.memberId) {
          continue; // guest
        }

        const key = p1.memberId + "|" + p2.memberId;
        partners.set(key, (partners.get(key) || 0) + trip.distance);
      }
    }
  }

  // sort and print
  const sorted = Array.from(partners.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100); // limit to 100

  sorted.forEach(([key, distance]) => {
    const [rower1, rower2] = key.split("|");
    const rower1Details = data.getRowerDetails(+rower1);
    const rower2Details = data.getRowerDetails(+rower2);
    console.log(
      `${rower1Details.rowerName} (${rower1}) og ${rower2Details.rowerName} (${rower2}) har roet ${distance} km`
    );
  });

  return await run();
}

async function partners(data: api.TripData): Promise<void> {
  const rower = await promptRower(data.getAllRowerIds());

  const partners = new Map<number, number>(); // rowserId -> shared distance
  data.getAllTripsForRower(rower.id).forEach((trip) => {
    trip.participants.forEach((participant) => {
      if (!participant.memberId) {
        return; // guest
      }

      if (participant.memberId !== rower.id) {
        partners.set(
          participant.memberId,
          (partners.get(participant.memberId) || 0) + trip.distance
        );
      }
    });
  });

  // sort and print
  const sorted = Array.from(partners.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, distance]) => {
    console.log(
      data.getRowerDetails(id).rowerName +
        " (" +
        id +
        ") | " +
        +distance +
        " km"
    );
  });

  return await run();
}

async function rabbit(data: api.TripData): Promise<void> {
  // a rabbit is a member where the ID starts with the 2 digits from the current year
  const members = await api.members();
  const year = new Date().getFullYear().toString().substring(2, 4);

  const rabbitIds = members.getAllMembers()
    .filter((m) => m.id.toString().startsWith(year));

  let sumDist = 0;

  for (const rabbit of rabbitIds) {
    const trips = data.getAllTripsForRower(rabbit.id);
    const dist = trips.reduce((sum, t) => sum + t.distance, 0);
    sumDist += dist;
  }
  console.log(`Kaninerne har roet ${sumDist} km`);

  // print the total distance for all rowers for comparison
  const allDist = members.getAllMembers()
    .map((m) => data.getAllTripsForRower(m.id))
    .reduce((sum, trips) => sum + trips.reduce((sum, t) => sum + t.distance, 0), 0);
  console.log(`Alle roere har roet ${allDist} km`);

  // compute total distance from trips. 
  sumDist = 0;
  for (const trip of data.getTrips()) {
    sumDist += trip.distance * trip.participants.length;
  }
  console.log(`Alle roere har roet ${sumDist} km (fra turene)`);


  return await run();
}

async function mostTime(data: api.TripData): Promise<void> {
  const timeTaken = new Map<number, number>(); // rowerId -> time taken

  data.getTrips().forEach((trip) => {
    const duration = trip.endDateTime.getTime() - trip.startDateTime.getTime();
    trip.participants.forEach((participant) => {
      if (!participant.memberId) {
        return; // guest
      }
      timeTaken.set(
        participant.memberId,
        (timeTaken.get(participant.memberId) || 0) + duration
      );
    });
  });

  // sort and print
  const sorted = Array.from(timeTaken.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100); // limit to 100

  sorted.forEach(([id, time]) => {
    const days = Math.floor(time / (1000 * 60 * 60 * 24));
    const hours = Math.floor((time % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    console.log(
      data.getRowerDetails(id).rowerName +
        " (" +
        id +
        ") | " +
        days +
        " dage og " +
        hours +
        " timer"
    );
  });
      

  return await run();
}
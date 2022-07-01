import * as prompt from "../prompt";
import * as api from "../api/api";
import { promptRower } from "../util/rowerutils";

export async function run() {
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
      message: "Hvem har roet flest andre roere?",
    },
  ]);

  if (answer === "partners") {
    await partners(await api.trips());
  } else if (answer === "most-common") {
    await mostCommon(await api.trips());
  } else if (answer === "community") {
    await community(await api.trips());
    return;
  } else {
    throw new Error("Unknown answer");
  }
}

async function community(data: api.TripData) {
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

  // sort and print
  const sorted = Array.from(rowers.entries()).sort(
    (a, b) => b[1].size - a[1].size
  );
  sorted.forEach(([id, rowers]) => {
    console.log(
      `${data.getRowerDetails(id).rowerName} har roet med ${
        rowers.size
      } andre roere`
    );
  });
}

async function mostCommon(data: api.TripData) {
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
}

async function partners(data: api.TripData) {
  const rower = await promptRower(data);

  const partners = new Map<number, number>(); // rowserId -> shared distance
  data.getAllTripsForRower(rower.memberId).forEach((trip) => {
    trip.participants.forEach((participant) => {
      if (!participant.memberId) {
        return; // guest
      }

      if (participant.memberId !== rower.memberId) {
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
}

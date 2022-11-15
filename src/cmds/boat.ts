import * as prompt from "../prompt";
import * as api from "../api/api";
import { promptRower } from "../util/rowerutils";

export async function run(): Promise<void> {
  const answer = await prompt.ask("Hvilen båd statestik?", [
    {
      name: "boat-individual",
      message: "Givet en roer, hvilke både bruger vedkommende mest?",
    },
    {
      name: "boat-global",
      message: "Hvilke både bliver brugt mest?",
    },
    {
      name: "boat-partner",
      message: "Givet en båd, hvem har roet den mest?",
    },
    {
      name: "time-in-boat",
      message: "Hvilken sammensætning af roer og båd har brugt mest tid samme?",
    },
    {
      name: "back",
      message: "Tilbage",
    },
  ]);
  switch (answer) {
    case "boat-individual":
      return await boatIndividual(await api.trips());
    case "boat-global":
      return await boatGlobal(await api.trips());
    case "boat-partner":
      return await boatPartner(await api.trips());
    case "time-in-boat":
      return await timeInBoat(await api.trips());
    case "back":
      return await (await import("../main")).mainPrompt();
    default:
      throw new Error("Unknown answer");
  }
}

async function boatPartner(data: api.TripData) {
  const rowers = new Map<number, number>(); // rower -> distance

  const boatSelection = await prompt.ask(
    "Select boat",
    data.getAllBoatIds().map((id) => {
      return {
        name: id + "",
        message: data.getBoatName(id),
      };
    })
  );

  data.getTrips().forEach((trip) => {
    if (trip.boatId !== +boatSelection) {
      return;
    }
    trip.participants.forEach((participant) => {
      if (!participant.memberId) {
        return; // guest
      }
      rowers.set(
        participant.memberId,
        (rowers.get(participant.memberId) || 0) + trip.distance
      );
    });
  });

  // sort and print
  const sorted = Array.from(rowers.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, distance]) => {
    const rowerDetails = data.getRowerDetails(id);
    console.log(`${rowerDetails.rowerName} (${id}) has rowed ${distance} km`);
  });

  return await run();
}

async function boatGlobal(data: api.TripData) {
  const boats = new Map<number, number>(); // boatId -> distance
  data.getTrips().forEach((trip) => {
    boats.set(trip.boatId, (boats.get(trip.boatId) || 0) + trip.distance);
  });

  // sort and print
  const sorted = Array.from(boats.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, distance]) => {
    console.log(data.getBoatName(id) + " (" + id + ") | " + +distance + " km");
  });

  return await run();
}

async function boatIndividual(data: api.TripData) {
  const rower = await promptRower();

  const boats = new Map<number, number>(); // boatId -> distance
  data.getAllTripsForRower(rower.id).forEach((trip) => {
    boats.set(trip.boatId, (boats.get(trip.boatId) || 0) + trip.distance);
  });

  // sort and print
  const sorted = Array.from(boats.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, distance]) => {
    console.log(`Har roet ${data.getBoatName(id)} (${id}) ${distance} km`);
  });

  return await run();
}

async function timeInBoat(data: api.TripData) {
  const boats = new Map<`${number}|${number}`, number>(); // memberId | boatAt -> duration
  data.getTrips().forEach((trip) => {
    
    const duration = trip.endDateTime.getTime() - trip.startDateTime.getTime();
    trip.participants.forEach((participant) => {
      if (!participant.memberId) {
        return; // guest
      }
      const key =
        `${participant.memberId}|${trip.boatId}` as `${number}|${number}`;
      boats.set(key, (boats.get(key) || 0) + duration);
    });
  });

  // sort and print
  const sorted = Array.from(boats.entries())
    .sort((a, b) => b[1] - a[1])
    // limit to 100
    .slice(0, 100);
  sorted.forEach(([key, duration]) => {
    const [memberId, boatId] = key.split("|").map((s) => +s);
    const rowerDetails = data.getRowerDetails(memberId);
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
    console.log(
      `${rowerDetails.rowerName} (${memberId}) har roet ${data.getBoatName(
        boatId
      )} i ${days} dage og ${hours} timer`
    );
  });

  return await run();
}

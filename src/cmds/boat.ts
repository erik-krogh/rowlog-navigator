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
  const rower = await promptRower(data);

  const boats = new Map<number, number>(); // boatId -> distance
  data.getAllTripsForRower(rower.memberId).forEach((trip) => {
    boats.set(trip.boatId, (boats.get(trip.boatId) || 0) + trip.distance);
  });

  // sort and print
  const sorted = Array.from(boats.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, distance]) => {
    console.log(`Har roet ${data.getBoatName(id)} (${id}) ${distance} km`);
  });

  return await run();
}

import * as prompt from "../prompt";
import * as api from "../api/api";
import { promptRower } from "../util/rowerutils";

export async function run() {
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
  ]);
  if (answer === "boat-individual") {
    await boatIndividual(await api.trips());
  } else if (answer === "boat-global") {
    await boatGlobal(await api.trips());
  } else if (answer === "boat-partner") {
    await boatPartner(await api.trips());
  } else {
    throw new Error("Unknown answer");
  }
  return;
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
}

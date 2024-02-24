import * as prompt from "simple-cli-prompter";
import * as api from "../api/rokort.js";
import { promptRower } from "../util/rowerutils.js";

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
      return await (await import("../main.js")).mainPrompt();
    default:
      throw new Error("Unknown answer");
  }
}

async function boatPartner(data: api.TripData) {
  const rowers = new Map<number, number>(); // rower -> distance

  const boatSelection = await prompt.ask("Select boat", data.getAllBoatNames());

  data.getTrips().forEach((trip) => {
    if (trip.boatName !== boatSelection) {
      return;
    }
    trip.participants.forEach((participant) => {
      if (!participant.id) {
        // TODO: does this happen?
        return; // guest
      }
      rowers.set(
        participant.id,
        (rowers.get(participant.id) || 0) + trip.distance,
      );
    });
  });

  const members = await api.members();

  // sort and print
  const sorted = Array.from(rowers.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, distance]) => {
    const rowerDetails = members.getMember(id);
    console.log(`${rowerDetails.name} (${id}) has rowed ${distance} km`);
  });

  return await run();
}

async function boatGlobal(data: api.TripData) {
  const boats = new Map<string, number>(); // boatName -> distance
  data.getTrips().forEach((trip) => {
    boats.set(trip.boatName, (boats.get(trip.boatName) || 0) + trip.distance);
  });

  // sort and print
  const sorted = Array.from(boats.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([name, distance]) => {
    console.log(name + " | " + +distance + " km");
  });

  return await run();
}

async function boatIndividual(data: api.TripData) {
  const rower = await promptRower();

  const boats = new Map<string, number>(); // boatName -> distance
  data.getAllTripsForRower(rower.id).forEach((trip) => {
    boats.set(trip.boatName, (boats.get(trip.boatName) || 0) + trip.distance);
  });

  // sort and print
  const sorted = Array.from(boats.entries()).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([name, distance]) => {
    console.log(`Har roet ${name} ${distance} km`);
  });

  return await run();
}

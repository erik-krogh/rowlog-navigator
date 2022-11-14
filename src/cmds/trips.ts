import * as prompt from "../prompt";
import * as colors from "ansi-colors";
import * as api from "../api/api";

export async function run(): Promise<void> {
  const trips = await api.trips();

  const rawAnswer = await prompt.ask(
    "Søg efter en tur",
    trips.getTrips().map((trip, i) => {
      return {
        name: i +"",
        message: trip.description + " " + trip.participants.map((p) => p.rowerName).join(", ") + " " + trip.distance + "km " + trip.startDateTime,
      }
    })
  );

  const trip = trips.getTrips()[parseInt(rawAnswer)];

  return await showTripDetails(trip);
}

async function showTripDetails(trip: api.Trip) {
  console.log(trip.description + " " + trip.distance + "km");
  console.log("Start: " + trip.startDateTime);
  for (const participant of trip.participants) {
    console.log(participant.rowerName + " (" + participant.memberId + ")");
  }

  return await promptAfterDetails(trip);
}
async function promptAfterDetails(trip: api.Trip): Promise<void> {
  const answer = await prompt.ask("Hvad nu?", [
    "Søg efter en anden tur",
    "Se rå data",
    "Se alle tilladelser",
    "Tilbage",
  ]);

  switch (answer) {
    case "Søg efter en anden tur":
      return await run();
    case "Se rå data":
      console.log(JSON.stringify(trip, null, 2));
      return await promptAfterDetails(trip);
    case "Tilbage":
      return await (await import("../main")).mainPrompt();
    default:
      throw new Error("Unknown answer");
  }
}

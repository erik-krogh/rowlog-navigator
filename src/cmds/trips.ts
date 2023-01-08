import * as prompt from "../prompt";
import * as api from "../api/api";

export async function run(): Promise<void> {
  const answer = await prompt.ask("Søg rundt i ture", [
    {
      name: "search",
      message: "Søg efter en tur",
    },
    {
      name: "popular",
      message: "Mest populære ture",
    },
    {
      name: "back",
      message: "Tilbage",
    },
  ]);

  switch (answer) {
    case "search":
      return await searchTrips();
    case "popular":
      return await popularTrips();
    case "back":
      return await (await import("../main")).mainPrompt();
    default:
      throw new Error("Unknown answer");
  }
}

async function searchTrips() {
  const trips = await api.trips();

  const rawAnswer = await prompt.ask(
    "Søg efter en tur",
    trips.getTrips().map((trip, i) => {
      return {
        name: i + "",
        message:
          trip.description +
          " " +
          trip.participants.map((p) => p.rowerName).join(", ") +
          " " +
          trip.distance +
          "km " +
          trip.startDateTime,
      };
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

async function popularTrips() {
  const trips = await api.trips();

  const tripCounter = new Map<string, number>(); // routeName -> count
  const distCounter = new Map<string, number>(); // routeName -> distance

  const routes = new Map<number, string>(); // routeId -> routeName
  for (const route of await api.routes()) {
    routes.set(route.id, route.description);
  }

  trips.getTrips().forEach((trip) => {
    const name = routes.get(trip.routeId) || trip.description;
    tripCounter.set(name, (tripCounter.get(name) || 0) + 1);
    distCounter.set(name, (distCounter.get(name) || 0) + trip.distance);
  });

  // sort and print
  const sorted = Array.from(tripCounter.entries()).sort((a, b) => b[1] - a[1]);

  sorted.forEach(([name, count]) => {
    const dist = distCounter.get(name) || 0;
    console.log(name + ": " + count + " ture. " + dist + " båd km");
  });

  return await run();
}

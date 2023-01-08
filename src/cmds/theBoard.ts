import * as prompt from "../prompt";
import * as api from "../api/api";

export async function run(): Promise<void> {
  const answer = await prompt.ask("Søg rundt i ture", [
    {
      name: "brabrand",
      message: "Brabrand kilometer. Hvem har roet mest på Brabrand?",
    },
    {
      name: "register",
      message: "Stats til registrer som sekrætæren kan bruge",
    },
    {
      name: "back",
      message: "Tilbage",
    },
  ]);

  switch (answer) {
    case "brabrand":
      return await brabrand();
    case "register":
      return await register();
    case "back":
      return await (await import("../main")).mainPrompt();
    default:
      throw new Error("Unknown answer");
  }
}

// for all trips, either the description mentions (lowercased) "brabrand" or the route description mentions "brabrand"
async function brabrand() {
  const map: Map<number, number> = new Map(); // memberId -> distance
  const routes: Map<number, string> = new Map(); // routeId -> routeDescription
  for (const route of await api.routes()) {
    routes.set(route.id, route.description);
    console.log(route.id, route.description);
  }
  for (const trip of (await api.trips()).getTrips()) {
    const route = trip.routeId ? routes.get(trip.routeId) : "";
    if (
      trip.description.toLowerCase().includes("brabrand") ||
      route?.toLowerCase().includes("brabrand")
    ) {
      for (const participant of trip.participants) {
        map.set(
          participant.memberId,
          (map.get(participant.memberId) || 0) + trip.distance
        );
      }
    }
  }

  const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);

  const members = await api.members();

  for (const [memberId, distance] of sorted) {
    const member = members.getMember(memberId);
    console.log(member?.name + " (" + memberId + ")\t" + distance);
  }

  return await run();
}

function getAge(mem: api.Member) {
  const bDate: Date = mem.birthDate;
  const now: Date = new Date();
  const age =
    ((now.getTime() - bDate.getTime()) / (1000 * 3600 * 24 * 365)) | 0;
  return age;
}

function createAgeTable(members: api.Member[], ages: number[]) {
  // ages is e.g. [13,18,24,59]. Which means 0-13, 14-18, 19-24, 25-59, 60+
  const males = new Array(ages.length + 1).fill(0);
  const females = new Array(ages.length + 1).fill(0);

  outer: for (const member of members) {
    for (const [index, age] of ages.entries()) {
      if (getAge(member) <= age) {
        if (member.raw.sex === "male") {
          males[index]++;
        } else {
          females[index]++;
        }
        continue outer;
      }
    }
    if (member.raw.sex === "male") {
      males[males.length - 1]++;
    } else {
      females[females.length - 1]++;
    }
  }

  console.log("Fordelt på køn og alder:");
  console.log("Alder\tMænd\tKvinder");
  for (const [index, age] of ages.entries()) {
    let str = "";
    if (index === 0) {
      str += "0-" + age;
    } else {
      str += ages[index - 1] + 1 + "-" + age;
    }
    str += "\t";
    str += males[index];
    str += "\t";
    str += females[index];
    console.log(str);
  }
  console.log(
    ages[ages.length - 1] +
      1 +
      "+\t" +
      males[males.length - 1] +
      "\t" +
      females[females.length - 1]
  );
}

async function register() {
  // first data for "idrætssamvirket".
  // samlet antal aktive medlemmer (number of members from api.members())
  // fordelt på køn og alder. 13-18, 19-24, 25-59 og 60+.
  console.log("Data til Idrætssamvirket");
  const members = await (await api.members()).getAllMembers();
  console.log("Totalt antal medlemmer: " + members.length + ".");
  createAgeTable(members, [12, 18, 24, 59]);

  console.log("\n");
  // data for "centralt foreningsregister".
  console.log("Data til Centralt Foreningsregister");
  // samlet antal
  console.log("Totalt antal medlemmer: " + members.length + ".");
  createAgeTable(members, [18, 24, 39, 59, 69]);

  const instructors = members.filter((m) =>
    m.permissions.toLowerCase().includes("i")
  );
  console.log("Totalt antal instruktører: " + instructors.length + ".");
  console.log("Instruktør fordeling på køn og alder:");
  createAgeTable(instructors, [24]);

  const boats: Map<number, api.Boat> = new Map();
  for (const boat of await api.boats()) {
    boats.set(+boat.id, boat);
  }
  const boatTypes: Map<number, api.BoatType> = new Map();
  for (const type of await api.boatTypes()) {
    boatTypes.set(+type.id, type);
  }

  const trips = await api.trips();
  // Hvor mange der har været ude i Coastal både.
  const coastal = members.filter((m) =>
    trips.getAllTripsForRower(m.id).some((t) => {
      const boat = boats.get(t.boatId);
      const type = boat && boatTypes.get(boat.boatTypeId);
      return type && type.description.toLowerCase().includes("coastal");
    })
  );

  console.log(
    "Totalt antal medlemmer der har været ude i Coastal både: " +
      coastal.length +
      "."
  );

  return await run();
}

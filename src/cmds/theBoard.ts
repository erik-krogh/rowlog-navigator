import * as prompt from "../prompt";
import * as api from "../api/api";
import * as colors from "ansi-colors";

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
      name: "tour",
      message: "Tour de ASR-trøjer",
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
    case "tour":
      return await tour();
    default:
      throw new Error("Unknown answer");
  }
}

/*
Gul = den der har roet flest km den pågældende måned
Grøn = den med flest Brabrand km
Prikket = den med flest langturskilometer
Hvid = den kanin der har roet flest km
Regnbue = den der har roet med flest forskellige

Jeg mindes, vi snakkede om, at den 20. i hver måned kunne være skillelinjen. Så det løber fra den 20. til den 20. Hver måned nulstilles der, så alle står lige ved start af en ny måned (dvs. den 20.). 
 */
async function tour() {
  // we print stats for the current month and the previous month.
  // we do that by creating a date, and setting the day to 20, and passing that to the "printTourStats" function
  const now = new Date();
  const currentMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    20,
    0,
    0,
    0,
    0
  );
  const previousMonth = goBackOneMonth(currentMonth);
  await printTourStats(currentMonth);
  await printTourStats(previousMonth);

  async function printTourStats(toDate: Date) {
    // start by printing the from/to dates
    const fromDate = goBackOneMonth(toDate);
    console.log(
      colors.bold(
        `Tour stats fra ${toPrettyDate(fromDate)} til ${toPrettyDate(toDate)}`
      )
    );
    const trips = (await api.trips()).getTrips().filter((trip) => {
      const t = trip.startDateTime;
      return t >= fromDate && t <= toDate;
    });
    const members = await api.members();

    console.log("Basseret på " + trips.length + " ture");

    function printStat(color: string, stat: string, metric: Map<number, number>) {
      if (metric.size === 0) {
        console.log(`${color}: Ingen ture`);
      } else {
        const sorted = Array.from(metric.entries()).sort((a, b) => b[1] - a[1]);
        const maxScore = sorted[0][1];
        const hasMaxScore = sorted.filter((x) => x[1] === maxScore);
        for (const mem of hasMaxScore) {
          const member = members.getMember(mem[0]);
          console.log(
            `${color}: ${member.name} (${member.id}): ${sorted[0][1]} ${stat}`
          );
        }
      }
    }

    // gul = den der har roet flest km den pågældende måned
    {
      const map: Map<number, number> = new Map(); // memberId -> distance
      for (const trip of trips) {
        for (const participant of trip.participants) {
          const distance = map.get(participant.memberId) || 0;
          map.set(participant.memberId, distance + (trip.distance || 0));
        }
      }
      printStat("Gul", "km", map);
    }

    // grøn = den med flest Brabrand km
    {
      const map: Map<number, number> = new Map(); // memberId -> distance
      const brabrandFilter = await getBrabrandFilter();

      for (const trip of trips) {
        if (brabrandFilter(trip)) {
          for (const participant of trip.participants) {
            const distance = map.get(participant.memberId) || 0;
            map.set(participant.memberId, distance + (trip.distance || 0));
          }
        }
      }
      printStat("Grøn", "km", map);
    }

    // prikket = den med flest langturskilometer
    {
      const map: Map<number, number> = new Map(); // memberId -> distance
      const routes = await api.routes();
      for (const trip of trips) {
        if (
          trip.description?.toLowerCase().includes("langtur") ||
          (trip.routeId &&
            routes
              .get(trip.routeId)
              ?.description?.toLowerCase()
              .includes("langtur"))
        ) {
          for (const participant of trip.participants) {
            const distance = map.get(participant.memberId) || 0;
            map.set(participant.memberId, distance + (trip.distance || 0));
          }
        }
      }
      printStat("Prikket", "km", map);
    }

    // hvid = den kanin der har roet flest km
    {
      // kanin = medlemsnummer der starter med det nuværende år. E.g. medlemsnummer 19020 startede i 2019.
      const map: Map<number, number> = new Map(); // memberId -> distance
      const rabbitPrefix = "22"; // TODO: now.getFullYear().toString().substring(2);

      for (const trip of trips) {
        for (const participant of trip.participants) {
          if (participant.memberId.toString().startsWith(rabbitPrefix)) {
            const distance = map.get(participant.memberId) || 0;
            map.set(participant.memberId, distance + (trip.distance || 0));
          }
        }
      }

      printStat("Hvid", "km", map);
    }

    // regnbue = den der har roet med flest forskellige
    {
      const map: Map<number, Set<number>> = new Map(); // memberId -> set of memberIds
      for (const trip of trips) {
        for (const participant of trip.participants) {
          if (!map.has(participant.memberId)) {
            map.set(participant.memberId, new Set());
          }
          const set = map.get(participant.memberId)!;
          for (const otherParticipant of trip.participants) {
            set.add(otherParticipant.memberId);
          }
        }
      }

      const sizeMap: Map<number, number> = new Map(); // memberId -> size of set
      map.forEach((value, key) => sizeMap.set(key, value.size));

      printStat("Regnbue", "forskellige", sizeMap);
    }

    console.log("\n");
  }

  return await run();
}

function goBackOneMonth(date: Date): Date {
  const result = new Date(date.getTime());
  if (result.getMonth() === 0) {
    result.setFullYear(result.getFullYear() - 1);
    result.setMonth(11);
  } else {
    result.setMonth(result.getMonth() - 1);
  }
  return result;
}

function toPrettyDate(date: Date) {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

// for all trips, either the description mentions (lowercased) "brabrand" or the route description mentions "brabrand"
async function brabrand() {
  const map: Map<number, number> = new Map(); // memberId -> distance
  const brabrandFilter = await getBrabrandFilter();

  for (const trip of (await api.trips()).getTrips()) {
    if (brabrandFilter(trip)) {
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

async function getBrabrandFilter() {
  const routes = await api.routes();

  return (trip: api.Trip) => {
    const route = trip.routeId ? routes.get(trip.routeId).description : "";
    return (
      trip.description.toLowerCase().includes("brabrand") ||
      route?.toLowerCase().includes("brabrand")
    );
  };
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

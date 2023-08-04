import * as prompt from "../prompt";
import * as api from "../api/newApi";
import * as colors from "ansi-colors";

export async function run(): Promise<void> {
  const answer = await prompt.ask("Søg rundt i ture", [
    {
      name: "brabrand",
      message: "Brabrand kilometer. Hvem har roet mest på Brabrand?",
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
  await printTourStats(currentMonth);
  await printTourStats(goBackOneMonth(currentMonth));
  await printTourStats(goBackOneMonth(goBackOneMonth(currentMonth)));

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

    console.log("Baseret på " + trips.length + " ture");

    function printStat(color: string, stat: string, metric: Map<number, number>) {
      if (metric.size === 0) {
        console.log(`${color}: Ingen ture`);
      } else {
        const sorted = Array.from(metric.entries()).filter(a => a[0] !== 0).sort((a, b) => b[1] - a[1]);
        const maxScore = sorted[0][1];
        const hasMaxScore = sorted.filter((x) => x[1] === maxScore);
        for (const mem of hasMaxScore) {
          const member = members.getMember(mem[0]);
          if (member) {
            console.log(
              `${color}: ${member.name} (${member.id}): ${mem[1]} ${stat}`
            );
          } else {
            console.log(
              `${color}: gæst? ${mem[0]}: ${mem[1]} ${stat}`
            ); 
          }
          
        }
      }
    }

    // gul = den der har roet flest km den pågældende måned
    {
      const map: Map<number, number> = new Map(); // memberId -> distance
      for (const trip of trips) {
        for (const participant of trip.participants) {
          const distance = map.get(participant.id) || 0;
          map.set(participant.id, distance + (trip.distance || 0));
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
            const distance = map.get(participant.id) || 0;
            map.set(participant.id, distance + (trip.distance || 0));
          }
        }
      }
      printStat("Grøn", "km", map);
    }

    // prikket = den med flest langturskilometer
    {
      const map: Map<number, number> = new Map(); // memberId -> distance
      for (const trip of trips) {
        if (
          trip.longtrip
        ) {
          for (const participant of trip.participants) {
            const distance = map.get(participant.id) || 0;
            map.set(participant.id, distance + (trip.distance || 0));
          }
        }
      }
      printStat("Prikket", "km", map);
    }

    // hvid = den kanin der har roet flest km
    {
      // kanin = medlemsnummer der starter med det nuværende år. E.g. medlemsnummer 19020 startede i 2019.
      const map: Map<number, number> = new Map(); // memberId -> distance
      const rabbitPrefix = now.getFullYear().toString().substring(2);

      for (const trip of trips) {
        for (const participant of trip.participants) {
          if (members.isRabbit(participant)) {
            const distance = map.get(participant.id) || 0;
            map.set(participant.id, distance + (trip.distance || 0));
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
          if (!map.has(participant.id)) {
            map.set(participant.id, new Set());
          }
          const set = map.get(participant.id)!;
          for (const otherParticipant of trip.participants) {
            set.add(otherParticipant.id);
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
          participant.id,
          (map.get(participant.id) || 0) + trip.distance
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
  return (trip: api.Trip) => {
    return trip.description.toLowerCase().includes("brabrand");
  };
}
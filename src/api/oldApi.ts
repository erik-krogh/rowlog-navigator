import * as https from "https";
import Cache from "../util/localcache";
import { getConfig } from "../util/config";
import * as util from "../util/rowerutils";
import * as currentSeason from "../util/currentSeason";

export function auth() {
  const config = getConfig();
  return Buffer.from(`${config.USER_NAME}:${config.PASSWORD}`).toString(
    "base64"
  );
}

if (2 > 1) {
  throw new Error("This file is not used anymore");
}

foo

type RawRower = {
  memberId: number;
  rowerName: string;
  isMinor: boolean;
  longRow: boolean;
  coxswain: boolean;
};

type RawTrip = {
  id: number;
  description: string;
  distance: number;
  createdDateTime: string;
  startDateTime: string;
  updatedDateTime: string;
  endDateTime: string;
  completed: boolean;
  excludeFromStats: boolean;
  boatId: string;
  boatName: string;
  routeId: number;
  participants: RawRower[];
};

export type Trip = {
  id: number;
  description: string;
  distance: number;
  createdDateTime: Date;
  startDateTime: Date;
  updatedDateTime: Date;
  endDateTime: Date;
  completed: true; // filtered out if they are not completed
  excludeFromStats: false; // also filtered out
  boatId: number;
  boatName: string;
  routeId: number;
  participants: RawRower[];
};

export type RowerDetails = Pick<RawRower, "memberId" | "rowerName">;

export class TripData {
  private rowers = new Map<number, RowerDetails>();
  private boats = new Map<number, string>();
  constructor(private trips: Trip[]) {
    for (const trip of trips) {
      for (const rower of trip.participants) {
        this.rowers.set(rower.memberId, rower);
      }
      this.boats.set(trip.boatId, trip.boatName);
    }
  }

  getTrips(): Trip[] {
    return this.trips;
  }

  getBoatName(id: number) {
    return this.boats.get(id);
  }

  getAllBoatIds(): number[] {
    return Array.from(this.boats.keys());
  }

  getAllRowerIds(): number[] {
    return this.trips
      .reduce((acc, trip) => {
        return acc.concat(trip.participants.map((p) => p.memberId));
      }, [] as number[])
      .filter((x) => x); // guests have no memberId, and are filtered out
  }

  getRowerDetails(rowerId: number): RowerDetails {
    return this.rowers.get(rowerId);
  }

  getAllTripsForRower(rowerId: number): Trip[] {
    return this.trips.filter((trip) =>
      trip.participants.some((p) => p.memberId === rowerId)
    );
  }
}

export const trips: () => Promise<TripData> = util.cache(async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const selectedSeason = currentSeason.getCurrentSeason();
  let trips = await fetchTrips(
    selectedSeason - 1 + "-10-31",
    yesterday.toISOString().substring(0, 10)
  );
  // everything after first of november is in the next season.
  trips = trips.filter(
    (t) => t.startDateTime < new Date(selectedSeason + "-11-01")
  );
  // everything before first of november previous year is in the previous season.
  trips = trips.filter(
    (t) => t.startDateTime >= new Date(selectedSeason - 1 + "-11-01")
  );

  return new TripData(trips);
}, 60 * 60);

async function fetchTrips(
  startDateRaw: string,
  endDateRaw: string
): Promise<Trip[]> {
  const fetcher = new Cache("fetchTrips", async (date) => {
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const res = await fetchTripsRaw(
      prevDate.toISOString().substring(0, 10),
      date
    );
    // some ahead of time checks, to make sure the saved cache entry is valid
    {
      const arr = JSON.parse(res);
      if (!(arr instanceof Array)) {
        throw new Error("Invalid response");
      }
      if (arr.length) {
        if (!arr[0].createdDateTime) {
          throw new Error("Invalid trip");
        }
      }
    }
    return res;
  });

  const latestCacheKey : Date | undefined  = fetcher.getCacheKeys().map((x) => new Date(x)).sort((a, b) => b.getTime() - a.getTime())[0];

  const seenTripIds = new Set<string>();
  const rawTrips: RawTrip[] = [];
  // iterate each date between start and end
  const startDate = new Date(startDateRaw);
  const endDate = new Date(endDateRaw);
  const promises: Promise<void>[] = [];
  for (
    let date = startDate;
    date <= endDate;
    date.setDate(date.getDate() + 1)
  ) {
    const dateStr = date.toISOString().substring(0, 10);
    promises.push((async () => {
      // if within 10 days of latest cache entry, get fresh.
      if (latestCacheKey && date.getTime() > latestCacheKey.getTime() - 10 * 24 * 60 * 60 * 1000) {
        await fetcher.getFresh(dateStr);
      }

      const data = await fetcher.get(dateStr);
      for (const rawTrip of (JSON.parse(data) as RawTrip[]).reverse()) {
        const key = rawTrip.id + "|" + rawTrip.description + "|" + rawTrip.distance;
        if (!seenTripIds.has(key)) {
          seenTripIds.add(key);
          rawTrips.push(rawTrip);
        }
      }
    })());
  }

  await Promise.all(promises);

  const trips: Trip[] = rawTrips
    .filter((trip) => trip.completed && !trip.excludeFromStats)
    .map((rawTrip) => {
      return {
        id: rawTrip.id,
        description: rawTrip.description,
        distance: rawTrip.distance,
        createdDateTime: new Date(rawTrip.createdDateTime),
        startDateTime: new Date(rawTrip.startDateTime),
        updatedDateTime: new Date(rawTrip.updatedDateTime),
        endDateTime: new Date(rawTrip.endDateTime),
        completed: true,
        excludeFromStats: false,
        boatId: Number(rawTrip.boatId),
        boatName: rawTrip.boatName,
        routeId: rawTrip.routeId,
        participants: rawTrip.participants,
      };
    });

  return trips;
}

/** fetches the 100 most recent trips within the date range. */
function fetchTripsRaw(startDate: string, endDate: string): Promise<string> {
  const url = `https://rowlog.com/api/trips?to=${endDate}&from=${startDate}`;

  return fetch(url);
}

function fetch(url: string): Promise<string> {
  const config = getConfig();
  const headers = {
    "X-ClubId": config.SITE_ID,
    Authorization: `Basic ${auth()}`,
  };

  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          resolve(data);
        });
        res.on("error", (err) => {
          reject(err);
        });
      }
    );
  });
}

type PermissionRaw = {
  memberId: number;
  permissionId: number;
  permission: {
    id: number;
    condition: string;
    conditionPeriod: string;
    conditionQty: number;
    conditionType: string;
    coxswainPermission: boolean;
    description: string;
    permissionCode: string;
    winterPermission: false;
  };
};

type MemberRaw = {
  address: string;
  address2: string;
  birthDate: string;
  blocked: boolean;
  boatAdmin: boolean;
  boatRental: boolean;
  city: string;
  comment: string;
  contactEmailAddress: string;
  contactName: string;
  contactPhoneNo: string;
  emailAddress: string;
  emailEvents: boolean;
  enrolmentDate: string;
  guest: boolean;
  id: number;
  keyNo: string;
  lastVisitDateTime: string;
  loginCount: number;
  memberAdmin: boolean;
  memberTypeId: number;
  membershipFee: boolean;
  membershipFeeDate: string;
  mobilePhoneNo: string;
  name: string;
  newsletter: boolean;
  permissionCode: string;
  phoneNo: string;
  picture: string;
  postCode: string;
  releasedDate: string;
  sex: string;
  systemAdmin: boolean;
  userName: string;
  memberPermissions: PermissionRaw[];
};

export type Member = {
  id: number;
  name: string;
  birthDate?: Date;
  address: string;
  email: string;
  newsletter: boolean; // subscribed to rowlog
  phone: string;
  boatAdmin: boolean;
  systemAdmin: boolean;
  permissions: string;
  raw: MemberRaw;
  memberType: string;
};

export class MemberData {
  members: Member[];
  private idToMember: Map<number, Member> = new Map();
  private nameToMember: Map<string, Member> = new Map();

  constructor(members: Member[]) {
    this.members = members;
    this.idToMember = new Map();
    for (const member of members) {
      this.idToMember.set(member.id, member);
      this.nameToMember.set(member.name, member);
    }
  }

  getMember(memberId: number): Member {
    return this.members.find((member) => member.id === memberId);
  }

  getMemberByName(name: string): Member {
    name = name.replace(/\s+/g, " ").trim();
    return this.members.find(
      (member) => member.name.replace(/\s+/g, " ").trim() === name
    );
  }

  getAllMembers(): Member[] {
    return this.members;
  }
}

export const members: () => Promise<MemberData> = util.cache(async () => {
  return new MemberData(await fetchMembers());
}, 60 * 60);

async function fetchMembers(): Promise<Member[]> {
  let seenMembers = new Set<number>();
  let membersRaw: MemberRaw[] = [];

  const memberTypesPromise = memberTypes(); // starting early to speed up fetching

  const fetchRaw = async (offset: number): Promise<MemberRaw[]> => {
    const url = `https://rowlog.com/api/members?limit=100&offset=${offset}`;
    return JSON.parse(await fetch(url));
  };

  const fetches: Promise<MemberRaw[]>[] = [];
  for (let i = 0; i < 10; i++) {
    // prefetching the first 10, because that covered all the members last I checked.
    fetches.push(fetchRaw(i * 100));
  }

  let progress = true;
  let iteration = 0;
  while (progress) {
    progress = false;

    const data = await (fetches[iteration] || // eslint-disable-line @typescript-eslint/no-misused-promises
      (fetches[iteration] = fetchRaw(iteration * 100)));
    for (const member of data) {
      const id = member.id;
      if (!seenMembers.has(id)) {
        seenMembers.add(id);
        progress = true;
        membersRaw.push(member);
      }
    }

    iteration++;
  }

  const types = await memberTypesPromise;

  return membersRaw
    .filter((member) => member.id) // guest have ID 0
    .map((member) => {
      return {
        id: member.id,
        name: member.name.replace(/\s+/g, " ").trim(),
        birthDate: member.birthDate
          ? new Date(member.birthDate.split("T")[0])
          : null,
        address: (
          member.address.trim() +
          (member.address2 ? " " + member.address2.trim() : "") +
          ", " +
          member.postCode.trim() +
          " " +
          member.city
        ).replace(/\s+/, " "),
        email: member.emailAddress,
        newsletter: member.newsletter,
        phone: member.phoneNo,
        boatAdmin: member.boatAdmin,
        systemAdmin: member.systemAdmin,
        permissions: member.permissionCode,
        raw: member,
        memberType: types.find((t) => t.id === member.memberTypeId)
          ?.description,
      };
    });
}

type MemberType = {
  id: number;
  description: string;
  allowRowing: boolean;
};

async function memberTypes(): Promise<MemberType[]> {
  const url = `https://rowlog.com/api/membertypes`;
  return JSON.parse(await fetch(url));
}

export type Permission = {
  id: number;
  description: string;
  condition: string;
  conditionPeriod: string;
  conditionQty: number;
  conditionType: string;
  coxswainPermission: boolean;
  permissionCode: string;
  winterPermission: boolean;
};

export const permissions = util.cache<Promise<Permission[]>>(async () => {
  const url = `https://rowlog.com/api/permissions`;
  return JSON.parse(await fetch(url));
}, 60 * 60);

export type Route = {
  id: number;
  distance: number;
  gmapLat: string;
  gmapLng: string;
  description: string;
  longRow: string;
  routeGroupId: number;
};

export const routes = util.cache<Promise<Map<number, Permission>>>(async () => {
  const url = `https://rowlog.com/api/routes`;
  const routes: Permission[] = JSON.parse(await fetch(url));
  const res: Map<number, Permission> = new Map(); // routeId -> route
  for (const route of routes) {
    res.set(route.id, route);
  }
  return res;
}, 60 * 60);

export type Boat = {
  id: string;
  name: string;
  boatTypeId: number;
  allowReservation: boolean;
  blocked: boolean;
  boatOrder: number;
  description: string;
  excludeFromStats: boolean;
  ignoreSeats: boolean;
  otherBoat: boolean;
  ownerId: boolean;
  purchaseDate: Date;
  purchasePrice: number;
  serialNo: string;
};

export const boats = util.cache<Promise<Boat[]>>(async () => {
  const url = `https://rowlog.com/api/boats`;
  return JSON.parse(await fetch(url));
}, 60 * 60);

export type BoatType = {
  id: number;
  description: string;
  noOfSeats: number;
  sortOrder: number;
  mainTypeId: number;
};

export const boatTypes = util.cache<Promise<BoatType[]>>(async () => {
  const url = `https://rowlog.com/api/boattypes`;
  return JSON.parse(await fetch(url));
}, 60 * 60);

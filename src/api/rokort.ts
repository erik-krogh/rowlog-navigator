import got from "got";
import * as util from "../util/rowerutils.js";
import { getConfig } from "../util/config.js";
import * as currentSeason from "../util/currentSeason.js";
import { createInMemoryCache } from "../util/inMemoryCache.js";

export function auth() {
  const config = getConfig();
  return Buffer.from(`${config.USER_NAME}:${config.PASSWORD}`).toString(
    "base64",
  );
}

let sessionKey: Promise<string> | undefined;
function login() {
  if (typeof sessionKey !== "undefined") {
    return;
  }
  sessionKey = (async () => {
    const conf = getConfig();
    // Post to https://asr.rokort.dk/account/loginajax.
    // with an object: "{\"username\":user,\"password\":pass,\"remember\":true}"
    // and get a session key back (the .ASPXAUTH cookie)
    const resp = await got.post("https://asr.rokort.dk/account/loginajax", {
      json: {
        username: conf.USER_NAME,
        password: conf.PASSWORD,
        remember: true,
      },
      responseType: "json",
    });

    const res = resp.headers["set-cookie"][0].split(";")[0];
    if (!sessionKey) {
      throw new Error("No session key");
    }

    return res;
  })();
}

async function authHeader() {
  login();
  return {
    Cookie: `${await sessionKey}`,
  };
}

type RawMemberRow = [
  string, // Medlemsnr (stringified number) // [0]
  string, // Profile picture URL // [1]
  string, // Fornavn // [2]
  string, // Mellemnavn // [3]
  string, // Efternavn // [4]
  string, // Fødselsdag (dd-mm-yyyy) // [5]
  string, // email // [6]
  string, // telefon // [7]
  string, // online sidst (dd-mm-yyyy) // [8]
  string, // frigivet dato (dd-mm-yyyy) // [9]
  string, // blokeret (boolean) // [10]
  string, // ukendt // [11]
  string, // rettigheder (tags), TagXYZ,TagABC,TagDEF // [12]
];

export type Member = {
  id: number;
  internalId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  name: string;
  birthday: Date | null;
  email: string;
  phone: string;
  blocked: boolean;
  releasedDate: Date | null;
  lastOnline: Date | null;
  permissions: string[]; // TODO: Make some lookup.
  raw: RawMemberRow;
};

export type PublicMember = Pick<
  Member,
  "id" | "firstName" | "lastName" | "name" | "email"
>;

async function fetchMemberRawData(): Promise<Member[]> {
  // https://asr.rokort.dk/admin/GetMemberGridDataRaw?page=1&rows=10000&customFilter=Status-,MailDeliveryStatus-
  // The data is in the "rows" property, containing an `{id: ID, cell: rows..}` object.
  // Rows: Medlemsnr, brugernavn, Fornavn, Efternavn, Fødselsdag, email, telefon, blokeret, online sidst, antal login, frigivet dato, rettigheder (tags).
  const url =
    "https://asr.rokort.dk/admin/GetMemberGridDataRaw?sidx=TotalLogins&sord=desc&page=1&rows=100000&departmentFilter=&tagFilter=&notTagFilter=&searchText=&customFilter=Status-,MailDeliveryStatus-";
  const resp = await got.get(url, {
    headers: await authHeader(),
  });

  const rows: { id: string; cell: RawMemberRow }[] = JSON.parse(resp.body).rows;

  return rows.map((row) => {
    const raw = row.cell;
    // remove repeated spaces
    const name = `${raw[2]} ${raw[3]} ${raw[4]}`.replace(/\s+/g, " ").trim();
    return {
      id: parseInt(raw[0]),
      internalId: row.id,
      firstName: raw[2],
      middleName: raw[3],
      lastName: raw[4],
      birthday: parseSimpleDate(raw[5]),
      email: raw[6],
      phone: raw[7],
      lastOnline: parseSimpleDate(raw[8]),
      releasedDate: parseSimpleDate(raw[9]),
      blocked: raw[10] === "true",
      permissions: raw[12].split(","),
      raw,
      name,
    };
  });
}

export const members: () => Promise<MemberData> = util.cache(async () => {
  return new MemberData(await fetchMemberRawData());
}, 60 * 60);

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
      (member) => member.name.replace(/\s+/g, " ").trim() === name,
    );
  }

  getAllMembers(): Member[] {
    return this.members;
  }

  static async getTagsForMember(member: Member): Promise<TagData[]> {
    const t = await tags();
    return member.permissions.map((tagId) => {
      return t[tagId] || null;
    });
  }

  isRabbit(member: Member): boolean {
    const season = currentSeason.getCurrentSeason(); // the current year, in YYYY format.
    // if the member ID starts with the last two digits of the current year, they are a rabbit.
    return member.id.toString().startsWith(season.toString().slice(2));
  }
}

const detailsCache = createInMemoryCache<Record<string, string>>(
  60 * 60 * 1000,
);

type FormItem = {
  value: string;
  fieldName: string;
};

export async function getMemberDetails(
  member: Member,
): Promise<Record<string, string>> {
  const id = member.internalId;

  return detailsCache.getOrSet(id, async () => {
    try {
      const url = `https://asr.rokort.dk/api/memberdata/${id}`;
      const resp = await got.get(url, {
        headers: await authHeader(),
      });

      const fields: FormItem[] = JSON.parse(resp.body).formSections[0]
        .formItems;

      const result: Record<string, string> = {};
      for (const field of fields) {
        result[field.fieldName] = field.value;
      }

      return result;
    } catch (e) {
      console.error("Failed to get member details for " + id);
      console.error(e);
      throw e;
    }
  });
}

function parseSimpleDate(s: string) {
  if ((s + "").trim() === "") {
    return null;
  }
  var p = s.split("-");
  return new Date(+p[2], +p[1] - 1, +p[0], 0, 0, 0, 0);
}

type TagData = {
  displayName: string;
  name: string;
  category: string;
  color: string; // hex color
  viewOrder: number;
  tagType: number;
  createdTs: string; // Date, parse with new Date(string)
  entityId: string; // <- this is the tag ID
  modifiedTs: string;
  tagsAssigned: never[]; // always empty ¯\_(ツ)_/¯
};

async function fetchRawTags(): Promise<Record<string, TagData>> {
  const url = "https://asr.rokort.dk/api/tag";
  const resp = await got.get(url, {
    headers: await authHeader(),
  });

  const list: TagData[] = JSON.parse(resp.body);

  const res: Record<string, TagData> = {};
  for (const tag of list) {
    res[tag.entityId] = tag;
  }
  return res;
}

export const tags: () => Promise<Record<string, TagData>> = util.cache(
  async () => {
    return await fetchRawTags();
  },
  60 * 60,
);

type RawTrip = {
  sboatbn: string; // boat name
  sbpartname: string; // comma separated list of rower names
  sboatft: string; // startime, e.g. "2023-07-31T17:30:00"
  sboatdescription: string; // trip description
  sboatlng: boolean; // langtur
  sboatdist: number; // distance in km
};

const getRawTrips = util.cache(async () => {
  const url = "https://asr.rokort.dk/api/report/CR2517138924777463952";

  const rawData: RawTrip[] = JSON.parse(
    (
      await got.get(url, {
        headers: await authHeader(),
      })
    ).body,
  ).data;

  return rawData;
}, 60 * 60);

export type Trip = {
  description: string;
  distance: number;
  startDateTime: Date;
  boatName: string;
  longtrip: boolean;
  participants: Member[];
};

const tripsCache = createInMemoryCache<TripData>(60 * 60 * 1000);

export function trips(
  season: number = currentSeason.getCurrentSeason(),
): Promise<TripData> {
  return tripsCache.getOrSet(season + "", async () => {
    if (!currentSeason.POSSIBLE_SEAONS.includes(season)) {
      throw new Error("Invalid season: " + season);
    }

    const raw = await getRawTrips();
    const mems = await members();
    const names = new Map<string, Member>();
    for (const mem of mems.getAllMembers()) {
      names.set(mem.name, mem);
    }

    let trips = raw
      .filter((r) => !(r as any).type) // type = "system".
      .map((r) => {
        return {
          description: r.sboatdescription,
          distance: r.sboatdist,
          startDateTime: new Date(r.sboatft),
          boatName: r.sboatbn,
          longtrip: r.sboatlng,
          participants: r.sbpartname
            .split(",")
            .map((name) => {
              // normalize the name to remove repeated spaces.
              name = name.replace(/\s+/g, " ").trim();
              return names.get(name) || null;
            })
            .filter((x) => x),
        };
      });

    // everything after first of november is in the next season.
    trips = trips.filter((t) => t.startDateTime < new Date(season + "-11-01"));
    // everything before first of november previous year is in the previous season.
    trips = trips.filter(
      (t) => t.startDateTime >= new Date(season - 1 + "-11-01"),
    );

    return new TripData(trips);
  });
}

export class TripData {
  constructor(private trips: Trip[]) {}

  getTrips(): Trip[] {
    return this.trips;
  }

  getAllRowerIds(): number[] {
    return this.trips
      .reduce((acc, trip) => {
        return acc.concat(trip.participants.map((p) => p.id));
      }, [] as number[])
      .filter((x) => x); // guests have no memberId, and are filtered out
  }

  getAllTripsForRower(rowerId: number): Trip[] {
    return this.trips.filter((trip) =>
      trip.participants.some((p) => p.id === rowerId),
    );
  }

  getAllBoatNames() {
    return [...new Set(this.trips.map((t) => t.boatName))];
  }
}

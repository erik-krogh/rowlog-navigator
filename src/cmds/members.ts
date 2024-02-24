import * as prompt from "simple-cli-prompter";
import colors from "ansi-colors";
import * as api from "../api/rokort.js";

export async function run(): Promise<void> {
  const answer = await prompt.ask("Hvad vil du?", [
    "Søg efter et medlem",
    "Eksporter medlemsdata",
    "Tilbage",
  ]);

  if (answer === "Søg efter et medlem") {
    return await searchForMember();
  } else if (answer === "Eksporter medlemsdata") {
    return await exportMembers();
  } else if (answer === "Tilbage") {
    return await (await import("../main.js")).mainPrompt();
  }
}

export const permissionMap = {
  Coastal: "Cx",
  Friroet: "R",
  Roret: "R",
  Instruktør: "I",
  "Instruktør Sculler": "IS",
  K1: "K1",
  K2: "K2",
  K3: "K3",
  "Kortturs styrmand": "K1",
  "Langturs styrmand": "L",
  Langturstyrmand: "L",
  S: "S",
  S1: "S1",
  S2: "S2",
  Svømmeprøve: "SW",
  Vinterstyrmandsret: "V",
  "Under Instruktion": "UI",
};

export async function exportMembers() {
  const members = (await api.members()).getAllMembers();
  console.log("Eksporterer medlemsliste...");
  console.log("MemberNumber	FirstName	LastName	UI	R	K1	K2	K3	L	I	S	S1	S2	Cx	IS	SW");
  const tags = await api.tags();
  for (const member of members) {
    let perms = member.permissions
      .map((p: string) => {
        const tag = tags[p as any];
        return (
          permissionMap[tag.name.trim() as keyof typeof permissionMap] || null
        );
      })
      .filter((p) => p !== null);
    let permsString = "UI	R	K1	K2	K3	L	I	S	S1	S2	Cx	IS	SW"
      .split("\t")
      .map((p) => (perms.includes(p) ? "X" : ""))
      .join("\t");
    console.log(
      `${member.id}	${member.firstName}	${member.lastName}\t${permsString}`
    );
  }

  return await run();
}

export async function searchForMember(): Promise<void> {
  const members = await api.members();

  const rawAnswer = await prompt.ask(
    "Søg efter et medlem",
    members.getAllMembers().map((member) => {
      return {
        name: member.id + "",
        message: member.name + colors.dim(" (" + member.id + ")"),
        hint: member.email,
      };
    })
  );

  const member = members.getMember(Number(rawAnswer));

  return await showMemberDetails(member);
}
async function showMemberDetails(member: api.Member) {
  console.log(`${member.name} (${member.id})`);
  console.log(`${member.email}`);
  console.log(`${member.phone}`);
  // birthdate. As dd/mm/yyyy
  console.log(`Fødselsdag: ${toPrettyDate(member.birthday)}`);

  console.log(
    "Tags: " +
      (await api.MemberData.getTagsForMember(member))
        .map((p) => p.displayName)
        .join(", ")
  );

  return await promptAfterDetails(member);
}

export function toPrettyDate(date: Date) {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}
async function promptAfterDetails(member: api.Member): Promise<void> {
  const answer = await prompt.ask("Hvad nu?", [
    "Søg efter et andet medlem",
    "Se rå data",
    "Tilbage",
  ]);

  switch (answer) {
    case "Søg efter et andet medlem":
      return await searchForMember();
    case "Se rå data":
      console.log(JSON.stringify(member.raw, null, 2));
      return await promptAfterDetails(member);
    case "Tilbage":
      return await run();
    default:
      throw new Error("Unknown answer");
  }
}

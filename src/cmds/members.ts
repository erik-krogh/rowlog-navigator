import * as prompt from "../prompt";
import * as colors from "ansi-colors";
import * as api from "../api/newApi";

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

  console.log("Tags: " + (await api.MemberData.getTagsForMember(member)).map(p => p.displayName).join(", "));

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
      return await (await import("../main")).mainPrompt();
    default:
      throw new Error("Unknown answer");
  }
}

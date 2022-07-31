import * as prompt from "../prompt";
import * as colors from "ansi-colors";
import * as api from "../api/api";

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
  console.log(`${member.address}`);
  console.log(`${member.email}`);
  console.log(`${member.phone}`);
  if (member.newsletter) {
    console.log("Abonnerer på Rokort");
  }
  if (member.boatAdmin) {
    console.log("Bådadministrator");
  }
  if (member.systemAdmin) {
    console.log("Systemadministrator");
  }
  console.log(`${member.permissions}`);
  console.log(`Medlemstype: ${member.memberType}`);

  return await promptAfterDetails(member);
}
async function promptAfterDetails(member: api.Member): Promise<void> {
  const answer = await prompt.ask("Hvad nu?", [
    "Søg efter et andet medlem",
    "Se rå data",
    "Se alle tilladelser",
    "Tilbage",
  ]);

  switch (answer) {
    case "Søg efter et andet medlem":
      return await searchForMember();
    case "Se rå data":
      console.log(JSON.stringify(member.raw, null, 2));
      return await promptAfterDetails(member);
    case "Se alle tilladelser":
      await printPermissions(member);
      return await promptAfterDetails(member);
    case "Tilbage":
      return await (await import("../main")).mainPrompt();
    default:
      throw new Error("Unknown answer");
  }
}

async function printPermissions(member: api.Member): Promise<void> {
  let perms = member.permissions;

  const permissionMap: Map<string, api.Permission> = new Map();
  let sizes = [Infinity, -Infinity]; // min, max
  for (const perm of await api.permissions()) {
    permissionMap.set(perm.permissionCode, perm);
    sizes[0] = Math.min(sizes[0], perm.permissionCode.length);
    sizes[1] = Math.max(sizes[1], perm.permissionCode.length);
  }

  // recursive descent parser to parse the permissions string, trying the longest first.
  function parsePermissions(perms: string): api.Permission[] {
    if (perms.length === 0) {
      return [];
    }
    for (let i = sizes[1]; i >= sizes[0]; i--) {
      const perm = perms.substring(0, i);
      if (permissionMap.has(perm)) {
        try {
          return [permissionMap.get(perm)].concat(
            parsePermissions(perms.substring(i))
          );
        } catch (e) {
          continue;
        }
      }
    }
    throw new Error("Could not parse permissions");
  }

  console.log(colors.bold("Tilladelser: " + perms));
  for (const perm of parsePermissions(perms)) {
    console.log(perm.permissionCode + ": " + perm.description);
  }
}

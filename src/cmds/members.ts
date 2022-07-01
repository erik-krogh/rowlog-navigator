import * as prompt from "../prompt";
import * as colors from "ansi-colors";
import * as api from "../api/api";

export async function run() {
  console.log("Henter alle medlemmer fra databasen...");
  const members = await api.members();

  while (true) {
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
  }
}

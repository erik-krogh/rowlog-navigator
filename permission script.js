// Select the target node.
var target = document.querySelector("#content-area");

const seenAndHandlesTables = new Set();

// Create an observer instance.
var observer = new MutationObserver(function (mutations) {
  // find potential table to fill in.
  const table = $(
    ".modal-container .modal-content .modal-body table.table-borderless"
  );
  // the table header (<thread>) needs to have 3 elements: "Navn", "Antal", "".
  const children = table
    .find("thead")
    .children()
    .toArray()
    .map((e) => $(e).text().trim());
  if (
    children.length !== 3 ||
    children[0] !== "Navn" ||
    children[1] !== "Antal" ||
    children[2] !== ""
  ) {
    return;
  }

  if (seenAndHandlesTables.has(table)) {
    return;
  }

  // craft an array of all the names (the first column in each row).

  const names = table
    .find("tbody tr")
    .toArray()
    .map((e) => $(e).children().first().text().trim());

  console.log("Posting the names " + JSON.stringify(names));

  // put some placeholder text while we wait for the response.
  table.find("thead").children().eq(1).text("Rettigheder (indlæser)");
  table.find("tbody tr").each(function (i, e) {
    $(e).children().eq(1).text("...");
  });

  // request the permissions by POSTing the names to "https://asr1.webbies.dk:9001/permissions";
  $.post(
    "https://asr1.webbies.dk:9001/permissions",
    JSON.stringify(names),
    function (data, status) {
      console.log("Got response: " + data + " with status " + status);
      // just console log on error
      if (status !== "success") {
        console.log("error");
        return;
      }

      // the response data is a JSON array of permissions. Insert into the second column of each row.
      // but first replace the text of the header with "Rettigheder".
      table.find("thead").children().eq(1).text("Rettigheder");

      const permissions = JSON.parse(data);
      table.find("tbody tr").each(function (i, e) {
        $(e).children().eq(1).text(permissions[i]);
      });
    }
  );
});

// Pass in the target node, as well as the observer options.
observer.observe(document.querySelector("#content-area"), {
  subtree: true,
  childList: true,
});

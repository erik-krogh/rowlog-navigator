# Row thing

## Navigating rowlog data. 

Run `ts-node src/main.ts` and do stuff. You'll be guided through the setup process.

You can start a server with `ts-node src/server.ts`.  
If you point the `ROW_NAV_SERVER` option in your `config.json` file to that server, then you'll get a persistent storage of old events. 

## Calendar sync. 

Do the setup using `ts-node src/main.ts` first.

Start a server with `ts-node src/server.ts`, and make sure that server is publicly accessible.  

The `src/server.ts` will expose a `/events.ics` endpoint that returns the calendar events from rowlog as an ics file. 
This can be used with basically any calendar application.  

However, for a shared Google Calendar a different approach is recommended. Because the default polling rate for Google Calendar is very low. 
- Create an empty calendar in Google Calendar
- Use this thing: https://github.com/derekantrican/GAS-ICS-Sync 
- Point that to the `/events.ics` endpoint. 
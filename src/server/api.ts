import * as express from "express";
import { Request, Response, NextFunction } from "express";
const router = express.Router();
import * as config from "../util/config";
import * as newApi from "../api/newApi";

const checkToken = (req: Request, res: Response, next: NextFunction) => {
  if (true) {
    return next(); // TODO: TMP.
  }
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Extract the token

  if (token == null) {
    return res.sendStatus(401); // If no token is present, return 401 Unauthorized
  }

  const expectedToken = config.getConfig().SERVER_AUTH_KEY;

  if (token !== expectedToken) {
    return res.sendStatus(403); // If token doesn't match, return 403 Forbidden
  }

  next(); // If token matches, proceed to the next middleware or route handler
};

// trips.
router.get("/trips", checkToken, async (req, res) => {
  try {
    const season = req.query.season; // Get the value of the 'season' query parameter
    console.log(`Fetching trips for season ${season}...`);

    const trips = (await newApi.trips(Number(season))).getTrips();

    const respTrips = trips.map((trip) => {
      return {
        description: trip.description,
        startTime: trip.startDateTime,
        dist: trip.distance,
        boatName: trip.boatName,
        longTrip: trip.longtrip,
        participants: trip.participants.map((p) => {
          return p.id;
        }),
      };
    });

    res.json(respTrips);
  } catch (e) {
    console.error("Failed to get trips");
    console.error(e);
    res.status(500).send("Failed to get trips");
  }
});

// Get a member by ID
router.get("/members/:id", async (req, res) => {
  try {
    const memberId = Number(req.params.id); // Get the value of the 'id' path parameter
    console.log(`Fetching member with ID ${memberId}...`);

    const members = await newApi.members();
    const member = members.getMember(memberId);

    if (!member) {
      res.status(404).send("Member not found");
      return;
    }

    return res.status(200).json({
      id: member.id,
      name: member.name,
      email: member.email,
    });
  } catch (e) {
    console.error("Failed to get member");
    console.error(e);
    res.status(500).send("Failed to get member");
  }
});

// Export the router
export default router;

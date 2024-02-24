import * as express from "express";
import { Request, Response, NextFunction } from "express";
const router = express.Router();
import * as config from "../util/config";
import * as newApi from "../api/rokort";

const checkToken = (req: Request, res: Response, next: NextFunction) => {
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
    
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : null;
    if (startDate) {
      trips.filter((t) => t.startDateTime >= startDate);
      console.log(`Filtering trips with start date ${startDate}...`);
    }
    if (endDate) {
      // making sure the endDate is inclusive, so we add a day
      trips.filter((t) => t.startDateTime <= new Date(endDate.getTime() + 24 * 60 * 60 * 1000));
      console.log(`Filtering trips with end date ${endDate}...`);
    }

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
router.get("/member/:id", async (req, res) => {
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

router.get("/members", async (req, res) => {
  try {
    const members = await newApi.members();
    let ids = req.query.ids as string;
    if (!ids.startsWith("[")) {
      ids = "[" + ids + "]";
    }
    const memberIds = JSON.parse(ids as string) as number[];

    const respMembers = memberIds.map((id) => {
      const member = members.getMember(id);
      return {
        id: member.id,
        name: member.name,
        email: member.email,
      };
    });

    res.json(respMembers);
  } catch (e) {
    console.error("Failed to get members");
    console.error(e);
    res.status(500).send("Failed to get members");
  }
});

// Export the router
export default router;

import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
const router = express.Router();
import * as config from "../util/config";
import * as newApi from "../api/newApi";

const checkToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract the token

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
router.get('/trips', checkToken, async (req, res) => {
  const season = req.query.season; // Get the value of the 'season' query parameter

  const trips = (await newApi.trips(Number(season))).getTrips();

  res.json(trips);
});

// Export the router
export default router;
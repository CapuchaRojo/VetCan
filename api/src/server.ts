import express from "express";
import cors from "cors";
import { router } from "./routes";
import { errorHandler } from "./middleware/errorHandler";

export const startServer = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/api", router);
  app.use(errorHandler);

  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`API running on :${port}`));
};

import { Router, type IRouter } from "express";
import {
  GetCortexOverviewResponse,
  GetIntegrationStatusResponse,
} from "@workspace/api-zod";
import {
  activities,
  deadlines,
  integrations,
  projects,
} from "../lib/cortex-data";

const router: IRouter = Router();

router.get("/cortex/overview", (_req, res) => {
  const overview = {
    greeting: "Good morning, Abdulrahman",
    stats: {
      activeProjects: projects.filter((project) => project.status === "active")
        .length,
      openDeadlines: deadlines.filter((deadline) => !deadline.completed).length,
      focusMinutes: 142,
      studyProgress: 72,
    },
    projects,
    deadlines,
    activities,
    study: {
      course: "Computer Networks",
      progress: 72,
      nextLabel: "TCP Congestion Control",
      nextAt: "Today, 16:30",
    },
    integrations,
  };

  res.json(GetCortexOverviewResponse.parse(overview));
});

router.get("/cortex/integrations", (_req, res) => {
  res.json(GetIntegrationStatusResponse.parse(integrations));
});

export default router;
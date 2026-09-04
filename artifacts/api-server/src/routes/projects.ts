import { Router, type IRouter } from "express";
import {
  CreateProjectBody,
  CreateProjectResponse,
  ListProjectsResponse,
} from "@workspace/api-zod";
import { projects } from "../lib/cortex-data";

const router: IRouter = Router();

router.get("/projects", (_req, res) => {
  res.json(ListProjectsResponse.parse(projects));
});

router.post("/projects", (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const project = {
    id: `project-${Date.now()}`,
    name: parsed.data.name,
    path: parsed.data.path,
    status: parsed.data.status,
    stack: parsed.data.stack ?? [],
    updatedAt: "Just now",
    progress: 0,
  };
  projects.unshift(project);
  res.status(201).json(CreateProjectResponse.parse(project));
});

export default router;
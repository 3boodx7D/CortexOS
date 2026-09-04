import { Router, type IRouter } from "express";
import {
  CreateDeadlineBody,
  CreateDeadlineResponse,
  ListDeadlinesResponse,
  UpdateDeadlineBody,
  UpdateDeadlineParams,
  UpdateDeadlineResponse,
} from "@workspace/api-zod";
import { deadlines } from "../lib/cortex-data";

const router: IRouter = Router();

router.get("/deadlines", (_req, res) => {
  res.json(ListDeadlinesResponse.parse(deadlines));
});

router.post("/deadlines", (req, res) => {
  const parsed = CreateDeadlineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const deadline = {
    id: `deadline-${Date.now()}`,
    title: parsed.data.title,
    category: parsed.data.category,
    targetAt: parsed.data.targetAt,
    completed: false,
  };
  deadlines.push(deadline);
  res.status(201).json(CreateDeadlineResponse.parse(deadline));
});

router.patch("/deadlines/:id", (req, res) => {
  const params = UpdateDeadlineParams.safeParse(req.params);
  const parsed = UpdateDeadlineBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const deadline = deadlines.find((item) => item.id === params.data.id);
  if (!deadline) {
    res.status(404).json({ error: "Deadline not found" });
    return;
  }

  Object.assign(deadline, parsed.data);
  res.json(UpdateDeadlineResponse.parse(deadline));
});

export default router;
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cortexRouter from "./cortex";
import projectsRouter from "./projects";
import notesRouter from "./notes";
import deadlinesRouter from "./deadlines";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cortexRouter);
router.use(projectsRouter);
router.use(notesRouter);
router.use(deadlinesRouter);

export default router;

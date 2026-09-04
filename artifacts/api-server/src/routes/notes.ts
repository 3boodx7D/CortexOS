import { Router, type IRouter } from "express";
import {
  CreateNoteBody,
  CreateNoteResponse,
  DeleteNoteParams,
  ListNotesResponse,
  UpdateNoteBody,
  UpdateNoteParams,
  UpdateNoteResponse,
} from "@workspace/api-zod";
import { notes } from "../lib/cortex-data";

const router: IRouter = Router();

router.get("/notes", (_req, res) => {
  res.json(ListNotesResponse.parse(notes));
});

router.post("/notes", (req, res) => {
  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const note = {
    id: `note-${Date.now()}`,
    title: parsed.data.title,
    content: parsed.data.content ?? "",
    tag: parsed.data.tag ?? "General",
    pinned: parsed.data.pinned ?? false,
    updatedAt: "Just now",
  };
  notes.unshift(note);
  res.status(201).json(CreateNoteResponse.parse(note));
});

router.patch("/notes/:id", (req, res) => {
  const params = UpdateNoteParams.safeParse(req.params);
  const parsed = UpdateNoteBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const note = notes.find((item) => item.id === params.data.id);
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  Object.assign(note, parsed.data, { updatedAt: "Just now" });
  res.json(UpdateNoteResponse.parse(note));
});

router.delete("/notes/:id", (req, res) => {
  const params = DeleteNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const index = notes.findIndex((item) => item.id === params.data.id);
  if (index === -1) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  notes.splice(index, 1);
  res.sendStatus(204);
});

export default router;
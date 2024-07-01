import { Schema, model } from "mongoose";
import { Commit } from "./Commit";

const FileSchema = new Schema({
  installationId: { type: Number, required: true },
  owner: { type: String, required: true },
  repoName: { type: String, required: true },
  filePath: { type: String, required: true },
  commits: { type: [Commit], required: true },
  riskScore: { type: Number, required: true },
  predictedRiskScore: { type: Number, required: false },
  createdAt: { type: Date, default: new Date() },
  updatedAt: { type: Date, default: new Date() },
});

export const File = model("repoFile", FileSchema);

import { Schema, model } from "mongoose";

const TrainingFileSchema = new Schema({
  installationId: { type: Number, required: true },
  owner: { type: String, required: true },
  repoName: { type: String, required: true },
  filePath: { type: String, required: true },
  numberOfCommits: { type: Number, required: true },
  riskScore: { type: Number, required: true },
  createdAt: { type: Date, default: new Date().toLocaleString() },
  updatedAt: { type: Date, default: new Date().toLocaleString() },
});

export const TrainingFile = model("trainingFile", TrainingFileSchema);

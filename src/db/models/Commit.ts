import { Schema } from "mongoose";

export const Commit = new Schema({
  sha: { type: String, required: true },
  message: { type: String, required: true },
  date: { type: Date, required: true },
});

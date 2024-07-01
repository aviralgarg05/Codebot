import { JobName, JobStatus } from "../db/models/Job";

export type Job = {
  jobName: JobName;
  parameters: Record<string, any>;
  status: JobStatus;
  scheduledAt: Date;
  completedAt?: Date;
};

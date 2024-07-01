import { Probot } from "probot";
import { ToadScheduler, SimpleIntervalJob, AsyncTask } from "toad-scheduler";
import { JobModel, JobName, JobStatus } from "../db/models/Job";
import { Job } from "../types/Job";
import {
  pollPredictorModelStatus,
  queryMindDB,
} from "../services/predictionService";
import { getProbotInstance } from "../auth";
import { File } from "../db/models/File";
import { FileType } from "../types/File";
import { Model } from "mindsdb-js-sdk";

const app = getProbotInstance();

const jobBatchSize = 50;
const intervalInMinutes = 5;
const requestThrottleDelay = 1000;
const scheduler = new ToadScheduler();

export function predictedScoresUpdationScheduler() {
  try {
    /**
     * It is important to use async task here, because it may happen
     * that another job starts while the previous job is still in progress.
     * So, to make sure the jobs doesn't queue up, it is important to make
     * all jobs async to make sure every new job starts in a new thread.
     */
    const task = new AsyncTask("Update-predicted-scores", jobHandler);

    const job = new SimpleIntervalJob(
      { seconds: 60 * intervalInMinutes, runImmediately: true },
      task,
      {
        id: "job-1",
        preventOverrun: true,
      }
    );

    scheduler.addSimpleIntervalJob(job);
  } catch (error: any) {
    app.log.error(`Error occurred in update predicted scores scheduler`);
    app.log.error(error);
  }
}

const jobHandler = async () => {
  const app = getProbotInstance();
  try {
    const installationJobs: Job[] = await JobModel.find({
      status: JobStatus.Incomplete,
      jobName: JobName.InstallationJob,
    }).limit(jobBatchSize);

    const fileUpdationJobs: Job[] = await JobModel.find({
      status: JobStatus.Incomplete,
      jobName: JobName.FileUpdationJob,
    }).limit(jobBatchSize);

    handleAppInstallationJob(app, installationJobs);
    handleFileUpdationJob(app, fileUpdationJobs);
  } catch (error: any) {
    app.log.error(`Error in jobHandler: ${error.message}`);
    app.log.error(error);
  }
};

async function handleAppInstallationJob(app: Probot, jobs: Job[]) {
  try {
    if (jobs.length === 0) {
      app.log.info(`No app installation jobs left to complete`);
      return;
    }
    app.log.info(`Started app installation job at: [${new Date()}]`);

    const predictorModel: Model = await pollPredictorModelStatus();
    const promises = jobs.map(async (job) => {
      const isJobCompleted = await checkIfJobIsAlreadyComplete(app, job);
      if (!isJobCompleted) {
        await updateFileAndJobModels(
          await queryMindDB(app, predictorModel, job)
        );
        await new Promise((resolve) =>
          setTimeout(resolve, requestThrottleDelay)
        );
      }
    });

    await Promise.all(promises);

    app.log.info(
      `Completed app installation job successfully at [${new Date()}]`
    );
  } catch (error: any) {
    app.log.info(`Error occurred while handling app installation job`);
    app.log.info(error);
  }
}

async function handleFileUpdationJob(app: Probot, jobs: Job[]) {
  try {
    if (jobs.length === 0) {
      app.log.info(`No file updation jobs left to complete`);
      return;
    }
    app.log.info(`Started file updation job at: [${new Date()}]`);

    const predictorModel: Model = await pollPredictorModelStatus();
    const promises = jobs.map(async (job) => {
      const isJobCompleted = await checkIfJobIsAlreadyComplete(app, job);
      if (!isJobCompleted) {
        await updateFileAndJobModels(
          await queryMindDB(app, predictorModel, job)
        );
        await new Promise((resolve) =>
          setTimeout(resolve, requestThrottleDelay)
        );
      }
    });

    await Promise.all(promises);

    app.log.info(`Completed file updation job successfully at [${new Date()}]`);
  } catch (error: any) {
    app.log.error(`Error occurred while handling file updation job`);
    app.log.error(error);
  }
}

async function updateFileAndJobModels(file: FileType) {
  const filter = {
    installationId: file.installationId,
    owner: file.owner,
    repoName: file.repoName,
    filePath: file.filePath,
  };

  const update = {
    predictedRiskScore: file.predictedRiskScore,
    updatedAt: new Date(),
  };

  await Promise.all([
    File.updateOne(filter, update),
    /**
     * Here, we are updating the job status for each file
     * present in the current file batch. We have to use the
     * filter object constructed with file details instead of
     * job parameters to avoid redundant job fetching.
     *
     * Updating many documents is necessary here because, it may
     * happen that two jobs with same parameters but with different
     * job names are present in the collection. So, to avoid redundant
     * update calls it is important to update all the documents with
     * matching filter.
     */
    JobModel.updateMany(
      { parameters: filter },
      {
        status: JobStatus.Complete,
        completedAt: new Date(),
      }
    ),
  ]);
}

/**
 * It may happen that the job in the jobs list is already updated due to
 * batch update happening in the previous iteration. So, it's important
 * to check the job status first to avoid redundant update DB calls
 */
async function checkIfJobIsAlreadyComplete(app: Probot, job: Job) {
  const jobObj: Job | null = await JobModel.findOne({
    parameters: job.parameters,
  });
  if (jobObj === null) {
    app.log.error("job obj is null");
  }

  if (jobObj?.status === JobStatus.Complete) {
    return true;
  }
  return false;
}

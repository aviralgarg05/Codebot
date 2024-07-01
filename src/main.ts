import { Probot } from "probot";
import { connectMongoDB } from "./db/connections/mongodbConnection";
import { processRepositories } from "./services/repositoryService";
import eventConfigs from "./configs/github.webhook.event.configs.json";
import {
  constructMarkdownComment,
  createCommentOnGithub,
} from "./services/commentService";
import {
  processPullRequestOpenEvent,
  updateFilesInDb,
} from "./services/pullRequestService";
import { FileScoreMap } from "./types/File";
import { connectMindsDB } from "./db/connections/mindsdbConnection";
import {
  retrainPredictorModel,
  trainPredictorModel,
} from "./services/predictionService";
import {
  errorFallbackCommentForPRClosedEvent,
  errorFallbackCommentForPROpenEvent,
} from "./constants/Comments";
import { predictedScoresUpdationScheduler } from "./schedulers/predictedScoreScheduler";
import { getProbotInstance } from "./auth";

const app = getProbotInstance();

/**
 * This function is responsible for initializing the app and
 * delegating all the events received from github to various
 * modules. Probot handles the event routing, so we just need
 * to add listeners for all the events that we want to process.
 *
 * @param probotApp default probot instance
 */
export async function main(probotApp: Probot) {
  try {
    connectMongoDB().catch((error: any) => app.log.error(error));
    connectMindsDB().catch((error: any) => app.log.error(error));
    handleAppInstallationCreatedEvents(probotApp);
    handlePullRequestOpenEvents(probotApp);
    handlePullRequestClosedEvents(probotApp);
    trainPredictorModel();
    predictedScoresUpdationScheduler();
  } catch (error: any) {
    app.log.error("Error occured in main function");
    app.log.error(error);
  }
}

/**
 * App installation event is published when a user
 * installs the app on one or more repositories.
 * Read more about installation webhooks {@link https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation | here}
 * @param app default probot instance
 */
function handleAppInstallationCreatedEvents(app: Probot) {
  const events: any[] = [eventConfigs.app_installation.created];

  app.on(events, (context: any) => {
    app.log.info(
      `Received an event with event id: ${context.id}, name: ${context.name} and action: ${context.payload.action}`
    );
    processRepositories(app, context.payload).catch((error: any) => {
      app.log.error("Error while processing app installation event");
      app.log.error(error);
    });
  });
}

/**
 * Pull request open event is published when a user opens
 * a pull request on any repository. Read more about pull request
 * webhooks {@link https://docs.github.com/en/webhooks/webhook-events-and-payloads?actionType=opened#pull_request | here}
 *
 * @param app default probot instance
 */
function handlePullRequestOpenEvents(app: Probot) {
  const events: any[] = [eventConfigs.pull_request.opened];

  app.on(events, async (context: any) => {
    app.log.info(
      `Received an event with event id: ${context.id}, name: ${context.name} and action: ${context.payload.action}`
    );
    try {
      const files: FileScoreMap[] = await processPullRequestOpenEvent(
        app,
        context.payload
      );
      const comment = await constructMarkdownComment(app, files);
      const installationId = context.payload.installation.id;
      const pullRequestNumber = context.payload.number;
      const repoName = context.pull_request.base.repo.full_name;
      const logParams = {
        installationId: installationId,
        pullRequestNumber: pullRequestNumber,
        repoName: repoName,
      };
      createCommentOnGithub(app, comment, context, logParams);
    } catch (error: any) {
      app.log.error("Error while processing pull request opened event");
      app.log.error(error);
      const comment: string = errorFallbackCommentForPROpenEvent();
      createCommentOnGithub(app, comment, context);
    }
  });
}

/**
 * Pull request closed events are published when a user
 * closes a pull request on any repository. Read more about
 * pull request webhooks {@link https://docs.github.com/en/webhooks/webhook-events-and-payloads?actionType=opened#pull_request | here}
 *
 * @param app default probot instance
 */
function handlePullRequestClosedEvents(app: Probot) {
  const events: any[] = [eventConfigs.pull_request.closed];

  app.on(events, async (context: any) => {
    app.log.info(
      `Received an event with event id: ${context.id}, name: ${context.name} and action: ${context.payload.action}`
    );
    try {
      const areFilesUpdated: boolean = await updateFilesInDb(
        app,
        context.payload
      );
      if (areFilesUpdated) {
        const comment =
          "Risk scores are updated for all the files modified in this pull request.";
        const installationId = context.payload.installation.id;
        const pullRequestNumber = context.payload.number;
        const repoName = context.pull_request.base.repo.full_name;
        const logParams = {
          installationId: installationId,
          pullRequestNumber: pullRequestNumber,
          repoName: repoName,
        };
        createCommentOnGithub(app, comment, context, logParams);
      }
      retrainPredictorModel(app);

      return context;
    } catch (error: any) {
      app.log.error("Error while processing pull request closed event");
      app.log.error(error);
      const comment = errorFallbackCommentForPRClosedEvent();
      createCommentOnGithub(app, comment, context);
    }
  });
}

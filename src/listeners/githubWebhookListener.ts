import { Probot } from "probot";

export function listeningForGithubWebhookEvents(app: Probot, events: any[]) {
  try {
    app.log.info(`Listening for ${events} events`);
    let context: any;

    app.on(events, (eventContext: any) => {
      app.log.info(context.id);
      context = eventContext;
    });
    return context;
  } catch (error) {
    app.log.error(`Error occurred while listening for ${events} events`);
    return;
  }
}

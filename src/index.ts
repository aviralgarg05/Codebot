import { Probot } from "probot";
import { main } from "./main";

/**
 * This is the entry point of the app. Probot starts
 * the app by validating all the secrets required to
 * initialize the probot instance. The probot instance
 * is passed to all the event listeners to get the event
 * payload and to authorize all the bot activity on github.
 * For eg- probot handles all the auth related tasks required
 * for commenting on a pull request discussion thread
 *
 * @param app default probot instance {@link Probot}
 */
export default function app(app: Probot) {
  app.log.info("Yay! codebot was loaded");
  main(app);
}

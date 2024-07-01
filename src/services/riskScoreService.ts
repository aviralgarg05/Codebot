import { Commit } from "../types/Commit";
import { getTimeDifference } from "../utils";
import { Probot } from "probot";

/**
 * Calculates a risk score for a given set of commits based
 * on their timestamps and distribution.
 *
 * The function sorts commits chronologically, calculates the time difference
 * between each commit and the oldest commit, and assigns a hot spot factor to
 * each commit based on its temporal distance from the oldest commit.
 * The risk score is then determined using a logistic function applied to the
 * accumulated hot spot factors. In case of errors, the function logs warnings
 * for invalid commit dates and returns a default risk score of 0.
 *
 * This function is written by taking inspiration from {@link https://github.com/niedbalski/python-bugspots | bugspots}
 *
 * @param {Probot} app The Probot instance.
 * @param {Commit[]} commits An array of Commit objects representing
 * the commits to be analyzed.
 * @returns {number} The calculated risk score, indicating the risk
 * level associated with the commit history. A higher score suggests a
 * higher potential risk.
 */
export function calculateRiskScore(app: Probot, commits: Commit[]): number {
  try {
    if (commits.length === 0) {
      return 0;
    }

    commits.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      if (dateA.getTime() === dateB.getTime()) {
        return a.sha.localeCompare(b.sha);
      }

      return dateA.getTime() - dateB.getTime();
    });

    const oldestCommit = commits[0];
    let hotSpotFactor = 0;

    commits.forEach((commit: Commit) => {
      const commitDate = new Date(commit.date);
      if (commitDate instanceof Date && !isNaN(commitDate.getTime())) {
        const thisCommitDiff = getTimeDifference(commitDate);
        const lastCommitDiff = getTimeDifference(new Date(oldestCommit.date));
        let factor = thisCommitDiff / lastCommitDiff;
        factor = 1 - factor;

        hotSpotFactor += 1 / (1 + Math.exp(-12 * factor + 12));
      } else {
        app.log.warn(`Invalid commit date`);
        app.log.warn(commit);
      }
    });

    const riskScore = 1 / (1 + Math.exp(-12 * hotSpotFactor + 12));

    return riskScore;
  } catch (error: any) {
    app.log.error(error);
    return 0;
  }
}

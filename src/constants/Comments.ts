import { DataObject } from "json2md";

export enum CommentType {
  Error = "error",
}

/**
 * Function to generate a comment for an open pull request.
 *
 * @param rows - An array of file information.
 * @param rawScores - An array of raw risk scores.
 * @returns An array of data objects containing comments and tables.
 */
export function pullRequestOpenComment(
  rows: string[][],
  rawScores: string[][]
): DataObject[] {
  return [
    { h2: "Attention: Review Required for the Following Files" },
    {
      blockquote:
        "This curated list is designed to help you focus on files that may require you to pay more attention while reviewing the code. Files are prioritized based on their risk scores. A zero 'current risk score' or a zero 'predicted risk score' may indicate a new file or insufficient historical data. Your attention to these files is highly appreciated!",
    },
    {
      table: {
        headers: ["File Path", "Current Risk Score", "Predicted Risk Score"],
        rows: rows,
      },
    },
    { h3: "For Demo Purposes Only" },
    {
      p: "The above comment reflects the real scenario, where scores are truncated to only two decimal places. For the demo, raw scores are included to provide insight into how the scores are calculated.",
    },
    {
      table: {
        headers: ["File Path", "Current Risk Score", "Predicted Risk Score"],
        rows: rawScores,
      },
    },
  ];
}

/**
 * Function to generate a fallback comment for a pull request open event in case of an error.
 * @returns A string with information about the error
 */
export function errorFallbackCommentForPROpenEvent(): string {
  return "We are currently experiencing technical difficulties. Rest assured, we will display the risk scores the next time you open a pull request.";
}

/**
 * Function to generate a fallback comment for a pull request closed event in case of an error.
 * @returns A string with information about the error.
 */
export function errorFallbackCommentForPRClosedEvent(): string {
  return "An error occurred while updating the files modified in this closed pull request. No need to worry; we have a backup for all the files in this pull request. The risk scores will be updated soon.";
}

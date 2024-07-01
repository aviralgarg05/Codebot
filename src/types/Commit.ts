/**
 * The commit message is used to filter out commits that
 * are related to a bug fix. For eg- if commit message is something
 * like- 'bug fixed', then only this commit will be stored in the DB.
 * Commit sha is used to uniquely identify a commit and commit date is
 * the date on which the commit happened
 */
export type Commit = {
  sha: string;
  message: string;
  date: Date;
};

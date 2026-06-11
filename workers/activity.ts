let activeJobs = 0;

export function beginJob() {
  activeJobs += 1;
}

export function endJob() {
  activeJobs = Math.max(0, activeJobs - 1);
}

export function getActiveJobs() {
  return activeJobs;
}

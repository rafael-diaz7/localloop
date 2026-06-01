import { pathToFileURL } from "node:url";

export type WorkerStatus = {
  name: "localloop-worker";
  status: "idle";
};

export function getWorkerStatus(): WorkerStatus {
  return {
    name: "localloop-worker",
    status: "idle"
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(getWorkerStatus()));
}

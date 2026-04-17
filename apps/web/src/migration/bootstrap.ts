import { runStorageMigration } from "./storageMigration";

if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
  runStorageMigration(window.localStorage);
}

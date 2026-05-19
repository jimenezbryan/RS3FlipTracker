import type { Express } from "express";
import { createApp } from "../server/app";

let appPromise: Promise<Express> | undefined;

async function getApp() {
  if (!appPromise) {
    appPromise = createApp().then(({ app }) => app);
  }

  return appPromise;
}

export default async function handler(req: any, res: any) {
  const app = await getApp();
  return app(req, res);
}

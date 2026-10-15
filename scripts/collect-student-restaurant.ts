import { readFile } from "node:fs/promises";
import path from "node:path";
import { analyzeStudentRestaurantImage, STUDENT_RESTAURANT_MODEL } from "./student-restaurant-openai";
import { collectStudentRestaurant, parseStudentRestaurantApiUrl, parseStudentRestaurantReview, reviewedStudentRestaurantMenu } from "./student-restaurant";

async function main() {
  const missing = ["HAKSIK_API_URL", "OPENAI_API_KEY"].filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  try {
    const review = process.env.GITHUB_EVENT_NAME === "workflow_dispatch"
      ? parseStudentRestaurantReview(JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH ?? "", "utf8")))
      : undefined;
    const model = process.env.OPENAI_MODEL?.trim() || STUDENT_RESTAURANT_MODEL;
    const result = await collectStudentRestaurant({
      apiUrl: parseStudentRestaurantApiUrl(process.env.HAKSIK_API_URL!.trim()),
      outputPath: path.join(process.cwd(), "public/cafeteria/student-restaurant-1.json"),
      statePath: path.join(process.cwd(), ".cache/student-restaurant/state.json"),
      analysisContext: model,
      forceAnalysis: Boolean(review),
      analyze: async (image) => review
        ? reviewedStudentRestaurantMenu(review, image)
        : analyzeStudentRestaurantImage(image, { apiKey: process.env.OPENAI_API_KEY!.trim(), model }),
    });
    console.log(`Manna House menu: ${result}.`);
  } catch {
    console.error("Manna House collection failed; publication stopped. Check source availability and Secrets, then rerun.");
    process.exitCode = 1;
  }
}

void main();

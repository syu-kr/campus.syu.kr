import path from "node:path";
import { analyzeStudentRestaurantImage } from "./student-restaurant-openai";
import { collectStudentRestaurant, parseStudentRestaurantApiUrl } from "./student-restaurant";

async function main() {
  const missing = ["HAKSIK_API_URL", "OPENAI_API_KEY"].filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  try {
    const result = await collectStudentRestaurant({
      apiUrl: parseStudentRestaurantApiUrl(process.env.HAKSIK_API_URL!.trim()),
      outputPath: path.join(process.cwd(), "public/cafeteria/student-restaurant-1.json"),
      statePath: path.join(process.cwd(), ".cache/student-restaurant/state.json"),
      analyze: (image) => analyzeStudentRestaurantImage(image, { apiKey: process.env.OPENAI_API_KEY!.trim(), model: process.env.OPENAI_MODEL?.trim() }),
    });
    console.log(`Manna House menu: ${result}.`);
  } catch {
    console.error("Manna House collection failed; publication stopped. Check source availability and Secrets, then rerun.");
    process.exitCode = 1;
  }
}

void main();

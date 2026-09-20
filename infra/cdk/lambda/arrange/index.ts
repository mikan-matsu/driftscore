import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { generateArrangement } from "./engine/generateArrangement";
import { ENSEMBLE_PRESETS, DEFAULT_ENSEMBLE_ID } from "./engine/ensembles";
import type { Genre, Melody } from "./engine/types";

const GENRES: Genre[] = ["jazz", "rock", "classical", "samba"];

interface RequestBody {
  melody?: Melody;
  genre?: string;
  distortion?: number;
  ensembleId?: string;
}

function isValidMelody(melody: unknown): melody is Melody {
  if (!melody || typeof melody !== "object") return false;
  const m = melody as Melody;
  return typeof m.beatsPerBar === "number" && Array.isArray(m.notes);
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let body: RequestBody;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: "invalid JSON body" }) };
  }

  if (!isValidMelody(body.melody)) {
    return { statusCode: 400, body: JSON.stringify({ message: "melody is required" }) };
  }
  const genre = GENRES.includes(body.genre as Genre) ? (body.genre as Genre) : "jazz";
  const distortion = typeof body.distortion === "number" ? body.distortion : 30;
  const ensembleId = body.ensembleId && ENSEMBLE_PRESETS[body.ensembleId] ? body.ensembleId : DEFAULT_ENSEMBLE_ID;

  const arrangement = generateArrangement(body.melody, genre, distortion, ensembleId);

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ arrangement }),
  };
};

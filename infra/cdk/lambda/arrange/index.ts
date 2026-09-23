import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { generateArrangement, type SongForm } from "./engine/generateArrangement";
import { ENSEMBLE_PRESETS, DEFAULT_ENSEMBLE_ID } from "./engine/ensembles";
import { INSTRUMENTS } from "./engine/instruments";
import type { Genre, Melody } from "./engine/types";

const GENRES: Genre[] = ["jazz", "rock", "classical", "samba"];
// Freeform custom-ensemble picks are capped here — no arranging-theory reason
// for the exact number, just a sane ceiling on Lambda work per request and on
// how unwieldy the resulting score gets; matches assignRoles.ts's
// LARGE_ENSEMBLE_SIZE, past which idiomatic-register tolerance stops widening.
const MAX_CUSTOM_INSTRUMENTS = 10;

interface RequestBody {
  melody?: Melody;
  genre?: string;
  distortion?: number;
  ensembleId?: string;
  /** Freeform ensemble as a list of instrument catalog ids (INSTRUMENTS keys) — when present and non-empty, takes precedence over ensembleId. */
  instrumentIds?: string[];
  /** Pitch class 0-11 to transpose the melody's tonic to, or omitted/null to keep its own key. */
  keyRoot?: number | null;
  /** "full" for intro/theme/solo/break/reprise/ending; anything else (or omitted) keeps the existing single-pass theme arrangement. */
  songForm?: string;
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
  const keyRoot =
    typeof body.keyRoot === "number" && Number.isInteger(body.keyRoot) && body.keyRoot >= 0 && body.keyRoot <= 11
      ? body.keyRoot
      : null;
  const songForm: SongForm = body.songForm === "full" ? "full" : "theme";

  let customInstruments;
  if (Array.isArray(body.instrumentIds) && body.instrumentIds.length > 0) {
    const resolved = body.instrumentIds
      .filter((id): id is string => typeof id === "string")
      .slice(0, MAX_CUSTOM_INSTRUMENTS)
      .map((id) => INSTRUMENTS[id])
      .filter((def): def is NonNullable<typeof def> => Boolean(def));
    if (resolved.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ message: "instrumentIds contains no valid instrument" }) };
    }
    customInstruments = resolved;
  }

  const arrangement = generateArrangement(body.melody, genre, distortion, ensembleId, keyRoot, songForm, customInstruments);

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ arrangement }),
  };
};

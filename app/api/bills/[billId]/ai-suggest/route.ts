import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { container } from "@/composition-root/container";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";
import { AI_DAILY_LIMIT } from "@/lib/constants/config";

type Params = { params: Promise<{ billId: string }> };

type AiSuggestion = {
  itemId: string;
  participantIds: string[];
  mode: "equally";
};

type GroqSuggestionResponse = {
  suggestions: Array<{ itemId: string; participantIds: string[]; mode: string }>;
  reasoning: string;
};

// POST /api/bills/[billId]/ai-suggest
// Uses Groq to suggest who should pay for each item based on item names + participant names.
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    // Rate limit check
    const bypassIds = (process.env.OCR_BYPASS_USER_IDS ?? "").split(",").filter(Boolean);
    if (!bypassIds.includes(user.id)) {
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("ai_usage")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("used_at", startOfDay.toISOString());
      if ((count ?? 0) >= AI_DAILY_LIMIT) {
        return errorResponse(
          "AI_LIMIT_EXCEEDED",
          `Daily AI suggestion limit reached (${AI_DAILY_LIMIT}/day). Resets at midnight UTC.`,
          429
        );
      }
    }

    const { billId } = await params;
    const bill = await container.getBill.execute(billId);
    if (!bill) return errorResponse("NOT_FOUND", "Bill not found", 404);
    if (bill.items.length === 0) return errorResponse("BAD_REQUEST", "No items to suggest for", 400);
    if (bill.participants.length === 0) return errorResponse("BAD_REQUEST", "No participants on this bill", 400);

    const participantsPayload = bill.participants.map((p) => ({ id: p.id, name: p.name }));
    const itemsPayload = bill.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity }));

    const prompt = `You are a bill-splitting assistant. Suggest who should pay for each item based on item names and common sense.

Participants:
${participantsPayload.map((p) => `- id: "${p.id}", name: "${p.name}"`).join("\n")}

Items:
${itemsPayload.map((i) => `- id: "${i.id}", name: "${i.name}", quantity: ${i.quantity}`).join("\n")}

Rules:
- Assign personal items (specific drinks, individual meals) to the likely individual(s)
- Assign shared items (water, bread, sides, desserts to share) to everyone
- Use common sense: "beer"/"wine" → likely drinkers, "kids meal" → parents, "coffee" → coffee drinkers
- When unsure, assign to everyone
- Always use mode "equally" — the user can change the mode themselves after applying
- Every item must be assigned to at least one participant
- participantIds must only contain IDs from the participants list above
- Return ONLY valid JSON, no markdown, no explanation outside the JSON

{
  "suggestions": [
    { "itemId": "<exact id from items list>", "participantIds": ["<id1>", "<id2>"], "mode": "equally" }
  ],
  "reasoning": "brief one-line summary of your logic"
}`;

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content ?? "";
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    let parsed: GroqSuggestionResponse;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return errorResponse("AI_PARSE_ERROR", "AI returned an unreadable response. Please try again.", 500);
    }

    // Validate and sanitize — only keep valid itemIds and participantIds
    const validItemIds = new Set(bill.items.map((i) => i.id));
    const validParticipantIds = new Set(bill.participants.map((p) => p.id));
    const allParticipantIds = bill.participants.map((p) => p.id);

    const suggestions: AiSuggestion[] = (parsed.suggestions ?? [])
      .filter((s) => validItemIds.has(s.itemId))
      .map((s) => {
        const validPids = (s.participantIds ?? []).filter((pid) => validParticipantIds.has(pid));
        return {
          itemId: s.itemId,
          participantIds: validPids.length > 0 ? validPids : allParticipantIds,
          mode: "equally" as const,
        };
      });

    // Record usage
    await supabase.from("ai_usage").insert({ user_id: user.id });

    return successResponse({ suggestions, reasoning: parsed.reasoning ?? "" });
  } catch (error) {
    return handleApiError(error);
  }
}

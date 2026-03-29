import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(60),
  currency: z.string().min(3).max(3),
  participants: z.array(
    z.object({
      name: z.string().min(1).max(50),
      userId: z.string().uuid().nullable().optional(),
    })
  ).min(1),
});

// GET /api/templates — list user's templates with participants
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { data: templates, error } = await supabase
      .from("bill_templates")
      .select("id, name, currency, created_at, template_participants(id, name, user_id, position)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return successResponse(
      (templates ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        currency: t.currency,
        createdAt: t.created_at,
        participants: ((t.template_participants as Array<{ id: string; name: string; user_id: string | null; position: number }>) ?? [])
          .sort((a, b) => a.position - b.position)
          .map((p) => ({ id: p.id, name: p.name, userId: p.user_id })),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/templates — create a new template
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const body = await request.json();
    const input = CreateTemplateSchema.parse(body);

    const { data: template, error: tErr } = await supabase
      .from("bill_templates")
      .insert({ user_id: user.id, name: input.name, currency: input.currency })
      .select("id")
      .single();

    if (tErr || !template) throw tErr ?? new Error("Failed to create template");

    if (input.participants.length > 0) {
      const { error: pErr } = await supabase.from("template_participants").insert(
        input.participants.map((p, i) => ({
          template_id: template.id,
          name: p.name,
          user_id: p.userId ?? null,
          position: i,
        }))
      );
      if (pErr) throw pErr;
    }

    return successResponse({ id: template.id }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

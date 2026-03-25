import { NextResponse } from "next/server";
import { DomainError } from "../../domain/errors/DomainError";
import { ZodError } from "zod";

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof DomainError) {
    const status =
      error.code === "BILL_NOT_FOUND" ||
      error.code === "ITEM_NOT_FOUND" ||
      error.code === "PARTICIPANT_NOT_FOUND"
        ? 404
        : 400;
    return errorResponse(error.code, error.message, status);
  }

  if (error instanceof ZodError) {
    const issues = error.issues ?? [];
    const message = issues
      .map((e) => `${e.path.map(String).join(".")}: ${e.message}`)
      .join("; ");
    return errorResponse("VALIDATION_ERROR", message || error.message, 400);
  }

  console.error("Unhandled API error:", error);
  return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
}

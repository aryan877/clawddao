import { NextRequest, NextResponse } from "next/server";
import { generateAgentConfig } from "@shared/lib/ai";
import { verifyAuth, AuthError } from "@shared/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await verifyAuth(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const { values } = body;

    if (!values || typeof values !== "string" || values.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid 'values' field: expected a non-empty string" },
        { status: 400 }
      );
    }

    const config = await generateAgentConfig(values);

    return NextResponse.json(config);
  } catch (error) {
    console.error("Agent config generation error:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate agent configuration" },
      { status: 500 }
    );
  }
}

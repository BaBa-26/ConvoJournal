import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { UserPreferencesUpdateSchema, validate } from "@/lib/validators";
import { DEFAULT_PREFERENCES } from "@/types";
import type { UserPreferences, WidgetKey, TypeScale, ThemeLayout, ColorMode, SurfaceStyle } from "@/types";

// Shape a raw User row into a fully-defaulted UserPreferences object.
function toPreferences(user: {
  displayName: string | null;
  accentColor: string | null;
  typeScale: string;
  reminderTime: string | null;
  themeLayout: string;
  colorMode: string;
  widgetOrder: string[];
  hiddenWidgets: string[];
  backgroundImage: string | null;
  surfaceStyle: string;
}): UserPreferences {
  return {
    displayName:   user.displayName,
    accentColor:   user.accentColor,
    typeScale:     (user.typeScale as TypeScale) ?? DEFAULT_PREFERENCES.typeScale,
    reminderTime:  user.reminderTime,
    themeLayout:   (user.themeLayout as ThemeLayout) ?? DEFAULT_PREFERENCES.themeLayout,
    colorMode:     (user.colorMode as ColorMode) ?? DEFAULT_PREFERENCES.colorMode,
    widgetOrder:   (user.widgetOrder?.length ? user.widgetOrder : DEFAULT_PREFERENCES.widgetOrder) as WidgetKey[],
    hiddenWidgets: (user.hiddenWidgets ?? []) as WidgetKey[],
    backgroundImage: user.backgroundImage ?? null,
    surfaceStyle:   (user.surfaceStyle as SurfaceStyle) ?? DEFAULT_PREFERENCES.surfaceStyle,
  };
}

const SELECT = {
  displayName: true,
  accentColor: true,
  typeScale: true,
  reminderTime: true,
  themeLayout: true,
  colorMode: true,
  widgetOrder: true,
  hiddenWidgets: true,
  backgroundImage: true,
  surfaceStyle: true,
} as const;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const user = await prisma.user.findUnique({
      where:  { id: auth.userId },
      select: SELECT,
    });
    if (!user) return NextResponse.json(DEFAULT_PREFERENCES);
    return NextResponse.json(toPreferences(user));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[preferences GET]", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = validate(UserPreferencesUpdateSchema, body);
    if (!parsed.ok) return NextResponse.json(parsed.error, { status: 400 });

    // Only write the keys that were actually supplied (partial update).
    const data = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined)
    );

    const user = await prisma.user.update({
      where:  { id: auth.userId },
      data,
      select: SELECT,
    });
    return NextResponse.json(toPreferences(user));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error("[preferences PATCH]", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}

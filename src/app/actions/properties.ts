"use server";

import { revalidatePath } from "next/cache";
import { createProperty } from "@/lib/data/properties";
import { createClient } from "@/lib/supabase/server";

export type CreatePropertyState = {
  error?: string;
  success?: string;
};

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
  const text = (value as string)?.trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePrice(value: FormDataEntryValue | null): number | null {
  const text = (value as string)?.trim().replace(",", ".");
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function createPropertyAction(
  _prevState: CreatePropertyState,
  formData: FormData
): Promise<CreatePropertyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const title = (formData.get("title") as string)?.trim();
  const city = (formData.get("city") as string)?.trim();
  const neighborhood = (formData.get("neighborhood") as string)?.trim() || null;
  const propertyType = (formData.get("property_type") as string)?.trim();
  const price = parsePrice(formData.get("price"));
  const bedrooms = parseOptionalInt(formData.get("bedrooms"));
  const bathrooms = parseOptionalInt(formData.get("bathrooms"));
  const description = (formData.get("description") as string)?.trim() || null;
  const imageUrl = (formData.get("image_url") as string)?.trim() || null;
  const listingUrl = (formData.get("listing_url") as string)?.trim() || null;

  if (!title || !city || !propertyType) {
    return { error: "Title, city, and property type are required." };
  }

  if (price == null) {
    return { error: "Enter a valid price." };
  }

  try {
    await createProperty(supabase, {
      user_id: user.id,
      title,
      city,
      neighborhood,
      property_type: propertyType,
      price,
      bedrooms,
      bathrooms,
      description,
      image_url: imageUrl,
      listing_url: listingUrl,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create property.",
    };
  }

  revalidatePath("/properties");
  return { success: "Property created successfully." };
}

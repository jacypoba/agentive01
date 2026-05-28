"use server";

import { revalidatePath } from "next/cache";
import { createProperty, deleteProperty, updateProperty } from "@/lib/data/properties";
import { triggerFollowUpsForNewProperty } from "@/lib/follow-ups/triggers";
import { createClient } from "@/lib/supabase/server";
import type { PropertyUpdate } from "@/types/database";

export type PropertyActionState = {
  error?: string;
  success?: string;
};

export type CreatePropertyState = PropertyActionState;
export type UpdatePropertyState = PropertyActionState;

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

type ParsedPropertyForm =
  | { error: string }
  | {
      payload: PropertyUpdate & {
        title: string;
        city: string;
        property_type: string;
        price: number;
      };
    };

function parsePropertyFormData(formData: FormData): ParsedPropertyForm {
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

  return {
    payload: {
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
    },
  };
}

function revalidatePropertyPaths() {
  revalidatePath("/properties");
  revalidatePath("/dashboard/properties");
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

  const parsed = parsePropertyFormData(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  try {
    const property = await createProperty(supabase, {
      user_id: user.id,
      ...parsed.payload,
    });

    await triggerFollowUpsForNewProperty(supabase, user.id, property);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to create property.",
    };
  }

  revalidatePropertyPaths();
  return { success: "Property created successfully." };
}

export async function updatePropertyAction(
  _prevState: UpdatePropertyState,
  formData: FormData
): Promise<UpdatePropertyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const propertyId = (formData.get("property_id") as string)?.trim();
  if (!propertyId) {
    return { error: "Property ID is required." };
  }

  const parsed = parsePropertyFormData(formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  try {
    await updateProperty(supabase, propertyId, user.id, parsed.payload);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update property.",
    };
  }

  revalidatePropertyPaths();
  return { success: "Property updated successfully." };
}

export async function deletePropertyAction(
  propertyId: string
): Promise<PropertyActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  if (!propertyId.trim()) {
    return { error: "Property ID is required." };
  }

  try {
    await deleteProperty(supabase, propertyId, user.id);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to delete property.",
    };
  }

  revalidatePropertyPaths();
  return { success: "Property deleted successfully." };
}

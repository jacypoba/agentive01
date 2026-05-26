"use client";

import { useActionState } from "react";
import {
  createPropertyAction,
  type CreatePropertyState,
} from "@/app/actions/properties";
import { formatPropertyPrice } from "@/lib/properties/search-criteria";
import type { Property } from "@/types/database";

const initialState: CreatePropertyState = {};

type PropertiesAdminProps = {
  properties: Property[];
  dbError?: string | null;
};

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-white/40">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#0066FF]/50 focus:outline-none"
      />
    </label>
  );
}

export function PropertiesAdmin({ properties, dbError }: PropertiesAdminProps) {
  const [state, formAction, isPending] = useActionState(
    createPropertyAction,
    initialState
  );

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-lg font-semibold">Add property</h2>
        <p className="mt-1 text-sm text-white/45">
          Listings here are matched against WhatsApp leads by city, budget, and
          property type.
        </p>

        {dbError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          >
            Run{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
              supabase/migrations/006_properties.sql
            </code>{" "}
            first. {dbError}
          </div>
        )}

        {state.error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {state.error}
          </div>
        )}

        {state.success && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            {state.success}
          </div>
        )}

        <form action={formAction} className="mt-6 space-y-4">
          <Field label="Title" name="title" required placeholder="Moradia com jardim" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" name="city" required placeholder="Milano" />
            <Field
              label="Neighborhood"
              name="neighborhood"
              placeholder="Navigli"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Property type"
              name="property_type"
              required
              placeholder="Moradia"
            />
            <Field
              label="Price (EUR)"
              name="price"
              type="number"
              required
              placeholder="750000"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bedrooms" name="bedrooms" type="number" placeholder="3" />
            <Field label="Bathrooms" name="bathrooms" type="number" placeholder="2" />
          </div>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">
              Description
            </span>
            <textarea
              name="description"
              rows={3}
              placeholder="Short highlight for the AI to reference…"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#0066FF]/50 focus:outline-none"
            />
          </label>
          <Field
            label="Image URL"
            name="image_url"
            placeholder="https://…"
          />
          <Field
            label="Listing URL"
            name="listing_url"
            placeholder="https://…"
          />
          <button
            type="submit"
            disabled={isPending || !!dbError}
            className="rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Create property"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          Your listings ({properties.length})
        </h2>
        <div className="mt-4 space-y-4">
          {properties.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-12 text-center text-sm text-white/45">
              No properties yet. Add your first listing to enable AI
              recommendations.
            </div>
          ) : (
            properties.map((property) => (
              <article
                key={property.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{property.title}</h3>
                    <p className="mt-1 text-sm text-white/50">
                      {property.property_type} · {property.city}
                      {property.neighborhood ? `, ${property.neighborhood}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-[#00D4FF]">
                    {formatPropertyPrice(property.price)}
                  </p>
                </div>
                {(property.bedrooms != null || property.bathrooms != null) && (
                  <p className="mt-2 text-xs text-white/35">
                    {property.bedrooms != null ? `${property.bedrooms} bed` : ""}
                    {property.bedrooms != null && property.bathrooms != null
                      ? " · "
                      : ""}
                    {property.bathrooms != null ? `${property.bathrooms} bath` : ""}
                  </p>
                )}
                {property.description && (
                  <p className="mt-3 text-sm text-white/55">{property.description}</p>
                )}
                {property.listing_url && (
                  <a
                    href={property.listing_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-xs text-[#0066FF] hover:text-[#00D4FF]"
                  >
                    View listing
                  </a>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  createPropertyAction,
  deletePropertyAction,
  updatePropertyAction,
  type PropertyActionState,
} from "@/app/actions/properties";
import { formatPropertyPrice } from "@/lib/properties/search-criteria";
import type { Property } from "@/types/database";

const initialState: PropertyActionState = {};

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
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
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
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#0066FF]/50 focus:outline-none"
      />
    </label>
  );
}

export function PropertiesAdmin({ properties, dbError }: PropertiesAdminProps) {
  const formRef = useRef<HTMLElement>(null);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const editingProperty =
    properties.find((property) => property.id === editingPropertyId) ?? null;
  const isEditing = editingPropertyId != null;

  const [createState, createAction, createPending] = useActionState(
    createPropertyAction,
    initialState
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updatePropertyAction,
    initialState
  );

  const formAction = isEditing ? updateAction : createAction;
  const state = isEditing ? updateState : createState;
  const isPending = isEditing ? updatePending : createPending;

  useEffect(() => {
    if (state.success && isEditing) {
      setEditingPropertyId(null);
    }
  }, [state.success, isEditing]);

  function startEditing(propertyId: string) {
    setDeleteError(null);
    setDeleteSuccess(null);
    setEditingPropertyId(propertyId);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleDelete(property: Property) {
    const confirmed = window.confirm(
      `Delete "${property.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleteError(null);
    setDeleteSuccess(null);
    setDeletingId(property.id);

    startDeleteTransition(async () => {
      const result = await deletePropertyAction(property.id);
      setDeletingId(null);

      if (result.error) {
        setDeleteError(result.error);
        return;
      }

      if (editingPropertyId === property.id) {
        setEditingPropertyId(null);
      }
      setDeleteSuccess(result.success ?? "Property deleted.");
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section
        ref={formRef}
        className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
      >
        <h2 className="text-lg font-semibold">
          {editingProperty ? "Edit property" : "Add property"}
        </h2>
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

        <form
          key={editingPropertyId ?? "new"}
          action={formAction}
          className="mt-6 space-y-4"
        >
          <input
            type="hidden"
            name="property_id"
            value={editingPropertyId ?? ""}
          />
          <Field
            label="Title"
            name="title"
            required
            placeholder="Moradia com jardim"
            defaultValue={editingProperty?.title ?? ""}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="City"
              name="city"
              required
              placeholder="Milano"
              defaultValue={editingProperty?.city ?? ""}
            />
            <Field
              label="Neighborhood"
              name="neighborhood"
              placeholder="Navigli"
              defaultValue={editingProperty?.neighborhood ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Property type"
              name="property_type"
              required
              placeholder="Moradia"
              defaultValue={editingProperty?.property_type ?? ""}
            />
            <Field
              label="Price (EUR)"
              name="price"
              type="number"
              required
              placeholder="750000"
              defaultValue={editingProperty?.price ?? ""}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Bedrooms"
              name="bedrooms"
              type="number"
              placeholder="3"
              defaultValue={editingProperty?.bedrooms ?? ""}
            />
            <Field
              label="Bathrooms"
              name="bathrooms"
              type="number"
              placeholder="2"
              defaultValue={editingProperty?.bathrooms ?? ""}
            />
          </div>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">
              Description
            </span>
            <textarea
              name="description"
              rows={3}
              placeholder="Short highlight for the AI to reference…"
              defaultValue={editingProperty?.description ?? ""}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#0066FF]/50 focus:outline-none"
            />
          </label>
          <Field
            label="Image URL"
            name="image_url"
            placeholder="https://…"
            defaultValue={editingProperty?.image_url ?? ""}
          />
          <Field
            label="Listing URL"
            name="listing_url"
            placeholder="https://…"
            defaultValue={editingProperty?.listing_url ?? ""}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isPending || !!dbError}
              className="rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isPending
                ? "Saving…"
                : isEditing
                  ? "Update property"
                  : "Create property"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={() => setEditingPropertyId(null)}
                disabled={isPending}
                className="rounded-full border border-white/10 px-6 py-2.5 text-sm font-medium text-white/70 transition-all hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          Your listings ({properties.length})
        </h2>

        {deleteError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            {deleteError}
          </div>
        )}

        {deleteSuccess && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          >
            {deleteSuccess}
          </div>
        )}

        <div className="mt-4 space-y-4">
          {properties.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-12 text-center text-sm text-white/45">
              No properties yet. Add your first listing to enable AI
              recommendations.
            </div>
          ) : (
            properties.map((property) => {
              const isActive = editingPropertyId === property.id;
              const isDeletingThis =
                isDeleting && deletingId === property.id;

              return (
                <article
                  key={property.id}
                  className={`overflow-hidden rounded-2xl border bg-white/[0.02] transition-all ${
                    isActive
                      ? "border-[#0066FF]/40 ring-1 ring-[#0066FF]/20"
                      : "border-white/10"
                  }`}
                >
                  {property.image_url && (
                    <div className="relative h-36 w-full bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={property.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-white">
                          {property.title}
                        </h3>
                        <p className="mt-1 text-sm text-white/50">
                          {property.property_type} · {property.city}
                          {property.neighborhood
                            ? `, ${property.neighborhood}`
                            : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-medium text-[#00D4FF]">
                        {formatPropertyPrice(property.price)}
                      </p>
                    </div>

                    {(property.bedrooms != null ||
                      property.bathrooms != null) && (
                      <p className="mt-2 text-xs text-white/35">
                        {property.bedrooms != null
                          ? `${property.bedrooms} bed`
                          : ""}
                        {property.bedrooms != null &&
                        property.bathrooms != null
                          ? " · "
                          : ""}
                        {property.bathrooms != null
                          ? `${property.bathrooms} bath`
                          : ""}
                      </p>
                    )}

                    {property.description && (
                      <p className="mt-3 line-clamp-2 text-sm text-white/55">
                        {property.description}
                      </p>
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

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                      <button
                        type="button"
                        onClick={() => startEditing(property.id)}
                        disabled={isDeletingThis}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                          isActive
                            ? "bg-[#0066FF]/20 text-[#00D4FF] ring-1 ring-[#0066FF]/40"
                            : "border border-white/15 bg-white/[0.04] text-white hover:border-[#0066FF]/40 hover:bg-[#0066FF]/10"
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(property)}
                        disabled={isDeletingThis}
                        className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition-all hover:border-red-500/50 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {isDeletingThis ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

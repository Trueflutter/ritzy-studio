import type { GenerateFinalGroundedRenderInput } from "@ritzy-studio/ai";
import {
  parseRoomDesignSpecRow,
  parseSpatialIntent,
  planningFocalPoint,
  sortProductsForRenderReferences,
  type RoomDesignSpec,
  type SpatialIntent
} from "@ritzy-studio/domain";

import { LOCAL_SKU_FIDELITY_RENDER_REFERENCE_LIMIT, localSkuFidelityModeEnabled } from "@/lib/render-flags";
import type { ServiceSupabaseClient } from "@/lib/services/supabase-clients";

// S4 step 4: what the hero render is built from, loaded one way for the
// runner and for the tests that pin it: every photograph of the room in
// created_at order (the first is the camera), the approved concept and its
// image, the confirmed spec's preservation list and objects, the selected
// products in render priority order with their photographs, and the brief's
// spatial intent. The runner keeps its claim, success and failure writes;
// this module only answers "what goes into the picture".

export type FinalRenderPhoto = {
  assetId: string;
  storagePath: string;
  bytes: Buffer;
  mimeType: string;
  signedUrl: string | null;
};

export type FinalRenderProduct = {
  itemId: string;
  productId: string;
  specKey: string | null;
  category: string;
  roleLabel: string;
  selectionReason: string | null;
  name: string;
  retailerName: string;
  description: string | null;
  priceAed: number | null;
  dimensions: string | null;
  imageBytes: Buffer | null;
  imageMimeType: string | null;
  imageUrl: string | null;
};

export type LoadedFinalRenderInputs = {
  roomType: string;
  concept: { id: string; title: string; description: string | null };
  conceptImage: { storagePath: string; bytes: Buffer; mimeType: string; signedUrl: string | null } | null;
  photos: FinalRenderPhoto[];
  spec: RoomDesignSpec | null;
  products: FinalRenderProduct[];
  spatialIntent: SpatialIntent;
  focalPoint: string | null;
  // The hero's reference cap for this room (a dev flag widens it).
  heroReferenceCap: number;
  renderInput: (options: { imageDeadlineMs?: number; promptSuffix?: string | null }) => GenerateFinalGroundedRenderInput;
};

// A deterministic reason the render cannot start (the selection or the room
// is gone). The runner fails the job at once instead of burning retries.
export class FinalRenderInputError extends Error {}

export type FetchProductImage = (url: string) => Promise<{ bytes: Buffer; mimeType: string } | null>;

const SIGNED_URL_TTL_SECONDS = 60 * 30;

export function roleLabelFromSelectionReason(selectionReason: string | null) {
  return selectionReason?.match(/room role: ([^;]+)/)?.[1]?.trim() ?? null;
}

export function formatProductDimensionsForRender(
  dimensions:
    | {
        width_cm: number | null;
        depth_cm: number | null;
        height_cm: number | null;
        source_text: string | null;
      }
    | null
) {
  if (!dimensions) {
    return null;
  }

  if (dimensions.source_text) {
    return dimensions.source_text;
  }

  const parts = [
    dimensions.width_cm ? `W ${dimensions.width_cm} cm` : null,
    dimensions.depth_cm ? `D ${dimensions.depth_cm} cm` : null,
    dimensions.height_cm ? `H ${dimensions.height_cm} cm` : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" x ") : null;
}

export async function loadFinalRenderInputs({
  serviceSupabase,
  roomId,
  roomType,
  conceptId,
  selectedShoppingItemIds,
  fetchImage
}: {
  serviceSupabase: ServiceSupabaseClient;
  roomId: string;
  roomType: string;
  conceptId: string;
  selectedShoppingItemIds: string[];
  fetchImage: FetchProductImage;
}): Promise<LoadedFinalRenderInputs> {
  // Every read below distinguishes a failed read from an empty one: a pooler
  // blip must surface (and be retried by the queue), never read as "the
  // concept is gone" or "no contract on record".
  const { data: concept, error: conceptError } = await serviceSupabase
    .from("concepts")
    .select("id, title, description, primary_image_asset:room_assets!concepts_primary_image_asset_id_fkey(*)")
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (conceptError) {
    throw new Error(conceptError.message);
  }
  if (!concept) {
    throw new FinalRenderInputError("Final render job's concept no longer exists.");
  }

  // Every photograph of the room, the first as the camera. Ordered by
  // created_at until S5 gives the slots a stored order; plans reference the
  // photographs by asset id, so that change cannot mislabel them.
  const { data: photoRows, error: photoError } = await serviceSupabase
    .from("room_assets")
    .select("*")
    .eq("room_id", roomId)
    .eq("asset_type", "room_photo")
    .order("created_at", { ascending: true })
    .limit(3);
  if (photoError) {
    throw new Error(photoError.message);
  }
  const photoAssets = photoRows ?? [];
  if (photoAssets.length === 0) {
    throw new FinalRenderInputError("Final render job's room photo no longer exists.");
  }

  const photos: FinalRenderPhoto[] = [];
  for (const [index, asset] of photoAssets.entries()) {
    const { data: blob, error: downloadError } = await serviceSupabase.storage
      .from("room-assets")
      .download(asset.storage_path);
    if (downloadError || !blob) {
      if (index === 0) {
        throw new Error("The original room photo could not be prepared for final rendering.");
      }
      // An additional angle that cannot be read is left out; the plan then
      // sees one photograph fewer, which is honest.
      continue;
    }
    const { data: signed } = await serviceSupabase.storage
      .from("room-assets")
      .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS);
    photos.push({
      assetId: asset.id,
      storagePath: asset.storage_path,
      bytes: Buffer.from(await blob.arrayBuffer()),
      mimeType: asset.mime_type,
      signedUrl: signed?.signedUrl ?? null
    });
  }

  const conceptImageAsset = Array.isArray(concept.primary_image_asset)
    ? concept.primary_image_asset[0]
    : concept.primary_image_asset;
  let conceptImage: LoadedFinalRenderInputs["conceptImage"] = null;
  if (conceptImageAsset?.storage_path) {
    const { data: conceptBlob } = await serviceSupabase.storage
      .from("generated-renders")
      .download(conceptImageAsset.storage_path);
    if (conceptBlob) {
      const { data: signedConcept } = await serviceSupabase.storage
        .from("generated-renders")
        .createSignedUrl(conceptImageAsset.storage_path, SIGNED_URL_TTL_SECONDS);
      conceptImage = {
        storagePath: conceptImageAsset.storage_path,
        bytes: Buffer.from(await conceptBlob.arrayBuffer()),
        mimeType: conceptImageAsset.mime_type ?? "image/png",
        signedUrl: signedConcept?.signedUrl ?? null
      };
    }
  }

  // Only a CONFIRMED spec is a contract. An extracted one the shopper never
  // confirmed, or a row that does not parse, carries no preservation list.
  const { data: specRow, error: specError } = await serviceSupabase
    .from("room_design_specs")
    .select("*")
    .eq("room_id", roomId)
    .eq("concept_id", conceptId)
    .maybeSingle();
  if (specError) {
    throw new Error(specError.message);
  }
  const parsedSpec = specRow ? parseRoomDesignSpecRow(specRow) : null;
  const spec = parsedSpec?.status === "confirmed" ? parsedSpec : null;

  const { data: items = [], error: itemsError } = await serviceSupabase
    .from("shopping_list_items")
    .select(
      `
      *,
      product:products(
        *,
        retailer:retailers(name, status),
        dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
      )
    `
    )
    .in("id", selectedShoppingItemIds)
    .order("sort_order", { ascending: true });
  if (itemsError) {
    throw new Error(itemsError.message);
  }
  const selectedItems = (items ?? []).filter((item) => item.product);
  if (selectedItems.length === 0) {
    throw new FinalRenderInputError("Final render job's selected products no longer exist.");
  }
  // Render priority order is the only order now (the V2 ordering flag is
  // promoted for the final render): the planner reads the first eight as the
  // hero's references and hands the rest to the views.
  const orderedItems = sortProductsForRenderReferences(selectedItems, roomType);

  const products: FinalRenderProduct[] = await Promise.all(
    orderedItems.map(async (item) => {
      const product = item.product!;
      const image = product.primary_image_url ? await fetchImage(product.primary_image_url) : null;
      return {
        itemId: item.id,
        productId: product.id,
        specKey: item.spec_key ?? null,
        category: item.category,
        roleLabel: item.role_label ?? roleLabelFromSelectionReason(item.selection_reason) ?? item.category,
        selectionReason: item.selection_reason,
        name: product.name,
        retailerName: product.retailer?.name ?? "Retailer",
        description: product.description,
        priceAed: item.unit_price_aed,
        dimensions: formatProductDimensionsForRender(product.dimensions?.[0] ?? null),
        imageBytes: image?.bytes ?? null,
        imageMimeType: image?.mimeType ?? null,
        imageUrl: product.primary_image_url ?? null
      };
    })
  );

  const { data: designBrief, error: briefError } = await serviceSupabase
    .from("design_briefs")
    .select("structured_json")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (briefError) {
    throw new Error(briefError.message);
  }
  const spatialIntent = parseSpatialIntent(designBrief?.structured_json, roomType);
  // The planner and the placement review work from the chosen focal point,
  // or from the layout rules' own TV-wall assumption when the confirmed
  // design carries one (planningFocalPoint).
  const focalPoint = planningFocalPoint(spatialIntent, spec);
  const heroReferenceCap = localSkuFidelityModeEnabled(roomType) ? LOCAL_SKU_FIDELITY_RENDER_REFERENCE_LIMIT : 8;

  const [primaryPhoto, ...additionalPhotos] = photos;
  return {
    roomType,
    concept: { id: concept.id, title: concept.title, description: concept.description },
    conceptImage,
    photos,
    spec,
    products,
    spatialIntent,
    focalPoint,
    heroReferenceCap,
    renderInput: ({ imageDeadlineMs, promptSuffix }) => ({
      roomType,
      spatialIntent: {
        focalPoint: spatialIntent.focalPoint,
        seatingPriority: spatialIntent.seatingPriority,
        diningSeatCount: spatialIntent.diningSeatCount,
        mustKeepClear: spatialIntent.mustKeepClear
      },
      roomPhotoBytes: primaryPhoto.bytes,
      roomPhotoMimeType: primaryPhoto.mimeType,
      roomPhotoUrl: primaryPhoto.signedUrl,
      additionalRoomPhotos: additionalPhotos.map((photo) => ({
        bytes: photo.bytes,
        mimeType: photo.mimeType,
        url: photo.signedUrl
      })),
      conceptImageBytes: conceptImage?.bytes ?? null,
      conceptImageMimeType: conceptImage?.mimeType ?? null,
      conceptImageUrl: conceptImage?.signedUrl ?? null,
      conceptTitle: concept.title,
      conceptDescription: concept.description,
      mustPreserve: spec ? spec.mustPreserve : null,
      imageDeadlineMs,
      promptSuffix: promptSuffix ?? null,
      products: products.slice(0, heroReferenceCap).map((product) => ({
        name: product.name,
        retailerName: product.retailerName,
        category: product.category,
        roleLabel: product.roleLabel,
        visualMatchReason: product.selectionReason,
        description: product.description,
        priceAed: product.priceAed,
        dimensions: product.dimensions,
        imageBytes: product.imageBytes,
        imageMimeType: product.imageMimeType,
        imageUrl: product.imageUrl
      }))
    })
  };
}

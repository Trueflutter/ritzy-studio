import type { ProductMatchCandidate, ProductMatchRequest } from "./product-matching";

export type ProductMatchDimensionFitStatus =
  | "fits_room"
  | "oversized_width"
  | "oversized_depth"
  | "oversized_width_and_depth"
  | "missing_product_dimensions"
  | "missing_room_measurements";

export type ProductMatchDimensionFit = {
  status: ProductMatchDimensionFitStatus;
  productWidthCm: number | null;
  productDepthCm: number | null;
  roomWallLengthCm: number | null;
  roomDepthCm: number | null;
  sourceText: string | null;
  warnings: string[];
};

export function classifyProductMatchDimensionFit({
  candidate,
  roomMeasurements = null
}: {
  candidate: Pick<ProductMatchCandidate, "dimensions">;
  roomMeasurements?: ProductMatchRequest["roomMeasurements"];
}): ProductMatchDimensionFit {
  const productWidthCm = candidate.dimensions?.widthCm ?? null;
  const productDepthCm = candidate.dimensions?.depthCm ?? null;
  const roomWallLengthCm = roomMeasurements?.wallLengthCm ?? null;
  const roomDepthCm = roomMeasurements?.roomDepthCm ?? null;
  const sourceText = candidate.dimensions?.sourceText ?? null;

  if (!productWidthCm || !productDepthCm) {
    return dimensionFit({
      status: "missing_product_dimensions",
      productWidthCm,
      productDepthCm,
      roomWallLengthCm,
      roomDepthCm,
      sourceText,
      warnings: ["Product dimensions are missing; fit requires designer review."]
    });
  }

  if (!roomWallLengthCm || !roomDepthCm) {
    return dimensionFit({
      status: "missing_room_measurements",
      productWidthCm,
      productDepthCm,
      roomWallLengthCm,
      roomDepthCm,
      sourceText,
      warnings: ["Room measurements are missing; product fit cannot be checked."]
    });
  }

  const oversizedWidth = Boolean(productWidthCm && roomWallLengthCm && productWidthCm > roomWallLengthCm);
  const oversizedDepth = Boolean(productDepthCm && roomDepthCm && productDepthCm > roomDepthCm);

  if (oversizedWidth && oversizedDepth) {
    return dimensionFit({
      status: "oversized_width_and_depth",
      productWidthCm,
      productDepthCm,
      roomWallLengthCm,
      roomDepthCm,
      sourceText,
      warnings: ["Product width and depth exceed entered room measurements."]
    });
  }

  if (oversizedWidth) {
    return dimensionFit({
      status: "oversized_width",
      productWidthCm,
      productDepthCm,
      roomWallLengthCm,
      roomDepthCm,
      sourceText,
      warnings: ["Product width exceeds entered room wall length."]
    });
  }

  if (oversizedDepth) {
    return dimensionFit({
      status: "oversized_depth",
      productWidthCm,
      productDepthCm,
      roomWallLengthCm,
      roomDepthCm,
      sourceText,
      warnings: ["Product depth exceeds entered room depth."]
    });
  }

  return dimensionFit({
    status: "fits_room",
    productWidthCm,
    productDepthCm,
    roomWallLengthCm,
    roomDepthCm,
    sourceText,
    warnings: []
  });
}

function dimensionFit(fit: ProductMatchDimensionFit): ProductMatchDimensionFit {
  return fit;
}

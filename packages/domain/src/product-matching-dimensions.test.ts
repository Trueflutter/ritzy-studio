import assert from "node:assert/strict";

import { classifyProductMatchDimensionFit } from "./product-matching-dimensions";

assert.deepEqual(
  classifyProductMatchDimensionFit({
    candidate: {
      dimensions: {
        widthCm: 220,
        depthCm: 95,
        heightCm: 80,
        sourceText: "220 x 95 x 80 cm"
      }
    },
    roomMeasurements: {
      wallLengthCm: 320,
      roomDepthCm: 420
    }
  }),
  {
    status: "fits_room",
    productWidthCm: 220,
    productDepthCm: 95,
    roomWallLengthCm: 320,
    roomDepthCm: 420,
    sourceText: "220 x 95 x 80 cm",
    warnings: []
  }
);

assert.equal(
  classifyProductMatchDimensionFit({
    candidate: {
      dimensions: {
        widthCm: 360,
        depthCm: 95,
        heightCm: 80,
        sourceText: "360 x 95 x 80 cm"
      }
    },
    roomMeasurements: {
      wallLengthCm: 320,
      roomDepthCm: 420
    }
  }).status,
  "oversized_width"
);

assert.equal(
  classifyProductMatchDimensionFit({
    candidate: {
      dimensions: {
        widthCm: 220,
        depthCm: 450,
        heightCm: 80,
        sourceText: "220 x 450 x 80 cm"
      }
    },
    roomMeasurements: {
      wallLengthCm: 320,
      roomDepthCm: 420
    }
  }).status,
  "oversized_depth"
);

assert.equal(
  classifyProductMatchDimensionFit({
    candidate: {
      dimensions: {
        widthCm: 360,
        depthCm: 450,
        heightCm: 80,
        sourceText: "360 x 450 x 80 cm"
      }
    },
    roomMeasurements: {
      wallLengthCm: 320,
      roomDepthCm: 420
    }
  }).status,
  "oversized_width_and_depth"
);

assert.equal(
  classifyProductMatchDimensionFit({
    candidate: {
      dimensions: null
    },
    roomMeasurements: {
      wallLengthCm: 320,
      roomDepthCm: 420
    }
  }).status,
  "missing_product_dimensions"
);

assert.equal(
  classifyProductMatchDimensionFit({
    candidate: {
      dimensions: {
        widthCm: 220,
        depthCm: null,
        heightCm: 80,
        sourceText: "220 x unknown x 80 cm"
      }
    },
    roomMeasurements: {
      wallLengthCm: 320,
      roomDepthCm: 420
    }
  }).status,
  "missing_product_dimensions"
);

assert.equal(
  classifyProductMatchDimensionFit({
    candidate: {
      dimensions: {
        widthCm: 220,
        depthCm: 95,
        heightCm: 80,
        sourceText: "220 x 95 x 80 cm"
      }
    },
    roomMeasurements: null
  }).status,
  "missing_room_measurements"
);

assert.equal(
  classifyProductMatchDimensionFit({
    candidate: {
      dimensions: {
        widthCm: 220,
        depthCm: 95,
        heightCm: 80,
        sourceText: "220 x 95 x 80 cm"
      }
    },
    roomMeasurements: {
      wallLengthCm: 320,
      roomDepthCm: null
    }
  }).status,
  "missing_room_measurements"
);

console.log("product matching dimension tests passed");

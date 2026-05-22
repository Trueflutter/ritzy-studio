import assert from "node:assert/strict";

import { isSupportedOpenAiVisualInputImageUrl } from ".";

assert.equal(
  isSupportedOpenAiVisualInputImageUrl(
    "https://mp-sellers-files.danubehome.com/sellers/LUMINA-DECOR/pi/179900134313/image_1759584979749.heif"
  ),
  false
);

assert.equal(
  isSupportedOpenAiVisualInputImageUrl(
    "https://example.com/products/sofa.PNG?width=1200&quality=90"
  ),
  true
);

assert.equal(
  isSupportedOpenAiVisualInputImageUrl("https://example.com/image-proxy?id=123"),
  true
);

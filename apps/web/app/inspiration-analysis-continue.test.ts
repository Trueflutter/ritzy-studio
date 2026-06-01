import assert from "node:assert/strict";

import {
  inspirationAnalysisContinueDecision,
  INSPIRATION_ANALYSIS_CONTINUE_FAILURE_MESSAGE
} from "./inspiration-analysis-continue";

assert.equal(
  inspirationAnalysisContinueDecision({
    inspirationAssetCount: 2,
    structuredJson: {
      inspirationAnalysis: {
        styleDirection: "warm modern",
        palette: ["warm white", "walnut"]
      }
    }
  }),
  "use_existing_analysis"
);

assert.equal(
  inspirationAnalysisContinueDecision({
    inspirationAssetCount: 1,
    structuredJson: {
      inspirationAnalysis: {}
    }
  }),
  "run_analysis"
);

assert.equal(
  inspirationAnalysisContinueDecision({
    inspirationAssetCount: 1,
    structuredJson: {}
  }),
  "run_analysis"
);

assert.equal(
  inspirationAnalysisContinueDecision({
    inspirationAssetCount: 0,
    structuredJson: {}
  }),
  "continue_without_analysis"
);

assert.equal(
  INSPIRATION_ANALYSIS_CONTINUE_FAILURE_MESSAGE,
  "We couldn't read the inspiration image yet. You can continue manually or try again."
);

console.log("inspiration analysis continue tests passed");

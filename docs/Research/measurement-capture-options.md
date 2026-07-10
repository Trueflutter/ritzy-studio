# Ritzy Studio Measurement Capture Options

Date: 2026-05-22  
Audience: Chief Architect  
Context: Ritzy Studio is currently web-first. The product needs room dimensions accurate enough to protect trust around furniture fit, especially for Dubai villas and townhouses where users may have whole-home developer plans, no standalone room plans, or no plan at all.

## Executive Recommendation

Do not base Ritzy Studio's measurement experience on pure photo-only AI. I did not find credible evidence that photo-only room estimation is accurate enough for furniture fit without a known scale, LiDAR/depth capture, a floor plan, or manual confirmation.

For MVP, keep the measurement workflow web-first:

1. Let users upload a full-home floor plan as PDF/image.
2. Ask them to select or confirm the target room.
3. Extract labels and dimensions where possible.
4. Require user confirmation of the dimensions that affect furniture fit: room length, room width, ceiling height if relevant, door swings/openings, window positions, and any wall niches or built-ins.
5. If no plan exists, ask for simple manual measurements instead of promising automatic photo-based sizing.

For V2, pilot a plan-parsing API such as Tectly, and evaluate Archilogic if a broader 3D/spatial data model becomes useful.

For a future native app, build iOS RoomPlan capture first. It is the most direct route to structured room geometry with walls, openings, windows, doors, and dimensions. For Android, prefer a partner SDK or workflow such as magicplan or CubiCasa before building custom ARCore Depth logic.

## Key Product Boundary

Ritzy can make the measurement experience low-friction, but it should not quietly convert uncertain dimensions into confident shopping recommendations. Any tight furniture clearance should be treated as requiring verified measurements.

Suggested product language:

- "Estimated from your plan. Please confirm before buying."
- "Verified by you."
- "Needs measurement: this sofa has less than 10 cm clearance."
- "Upload a plan, scan with a supported app, or enter measurements manually."

## What Can Work In A Browser Today?

Browser-feasible today:

- Uploading whole-home floor plans as PDF, JPG, PNG, SVG, or similar.
- OCR and visual parsing of room names, printed dimensions, wall outlines, doors, and windows.
- A web review UI where the user picks the room and confirms extracted dimensions.
- Manual dimension entry.
- Importing third-party exports such as PDF, SVG, DXF, CSV, IFC, OBJ, or USDZ, depending on vendor output.
- Showing a calibrated plan overlay where the user confirms one known measurement to set scale.

Not browser-reliable today:

- Accurate iPhone LiDAR room scanning in Safari/Chrome.
- Apple RoomPlan in the browser.
- A cross-platform WebXR room scanner accurate enough for furniture fit.
- ARCore Depth room capture with automatic semantic room geometry in browser.

The practical browser MVP is therefore plan ingestion plus confirmation, not live AR scanning.

## What Requires Native iOS Or Android?

Requires native capture:

- Apple RoomPlan / ARKit.
- ARCore Depth-based room capture.
- magicplan capture.
- RoomScan / RoomScan Pro LiDAR.
- CubiCasa capture.
- Canvas capture.
- Polycam floor-plan capture.
- KIRI Engine LiDAR/room or scene capture.

Some tools provide web portals or web viewers after capture, but the actual scan is native.

## Option Comparison

| Option | Browser Today | Native Required | APIs / Exports | Full-House Plan + Rooms | Length / Width / Height / Doors / Windows | Accuracy Signal | User Friction | Ritzy Fit |
|---|---:|---:|---|---:|---|---|---|---|
| Apple RoomPlan / ARKit | No | iOS/iPadOS with LiDAR | RoomPlan API; USD/USDZ export with component dimensions | Supports multi-room captured structures | Walls, doors, windows, openings, furniture categories; height/3D geometry available in model | Apple describes highly accurate measurements; no simple public tolerance | Requires compatible iPhone/iPad and scan flow | Best native future path |
| ARCore Depth / WebXR | Weak | Android for reliable ARCore | Depth frames/raw depth; no turnkey room-plan API | No built-in room semantics | Developer must infer geometry/openings | Google says best depth generally at 0.5m-5m and requires movement; not furniture-fit floor-plan accuracy by itself | High engineering effort and device variability | Not MVP; maybe research only |
| Matterport | Web viewer/API after capture | Capture app/camera or phone | APIs/SDK; Enterprise Property Intelligence dimension estimates; purchasable floor plans/MatterPak | Yes, model/floor/room structure | API can return room width, depth, height, area; floor plans include labels/measurements | Strong with proper capture, but API fields are estimates and Enterprise-gated | Account, scan, processing, paid tiers | Good import/partner option, not primary consumer MVP |
| magicplan | Cloud/export review only | iOS/Android capture | API/integrations; PDF, JPG, PNG, SVG, DXF, IFC, OBJ, USDZ, CSV | Yes | Room dimensions, areas, objects; laser measurement integration | Official docs say accuracy depends on conditions; Bluetooth laser recommended for certainty | App install, scan/edit/export | Strong V2 import option |
| RoomScan Pro | No | iOS LiDAR | XML, IFC, CSV, DXF, PDF, PNG, USDZ, OBJ, PLY, XYZ, Sweet Home 3D, ESX, FML | Yes | Semantic IFC/XML can include storeys, rooms, doors, windows | No clear official tolerance found | iOS-only app install and export | Strong import option for designer/pro users |
| CubiCasa | Web portal/output only | iOS/Android capture; SDK available | Mobile SDK; Conversion/Integrate APIs; JPG, PNG, PDF, SVG; paid/CAD options | Yes | Room labels and room dimensions in floor plans; doors/windows shown | Public reports cite 95-97% average accuracy; real-world complaints exist | 5-minute walkthrough plus processing | Good low-friction scan/import option; verify tight fits |
| Canvas | Web viewer/report after scan | iPhone/iPad LiDAR | Free OBJ export; paid CAD/BIM; PDF/XLS measurement report; DWG/PDF floor plans | Yes, whole-home merge possible | Reports include floors, walls, doors, windows, countertops, key dimensions | Vendor says most CAD measurements should be within 1-2% of tape/laser/blueprint | Pro workflow, per-square-foot cost | Best pro/as-built fallback for high-value projects |
| Polycam | Web edit/export after scan | LiDAR device for floor plans | PDF, DXF, PNG, SVG, CSV, ZIP; enterprise integrations | Yes, multi-floor capture/edit | Walls, windows, doors, furniture/fixtures; editable labels | Vendor says accuracy varies by scan complexity and user review is required | LiDAR scan; Business plan for floor plans | Useful import option, not primary source of truth |
| KIRI Engine | Web upload for photogrammetry; not structured plan | Mobile/LiDAR capture | OBJ, FBX, STL, GLB, GLTF, USDZ, PLY, XYZ | Not as structured room plan | Mesh/point cloud, not room labels/openings/dimensions | Not positioned as furniture-fit room-plan tool | Low cost but high downstream processing | Not recommended for room dimensions |
| Floor-plan parsing APIs | Yes | No | Tectly Cloud API; Archilogic conversion/API/SDK; emerging vendors | Yes, if input plan is readable | Rooms, walls, labels, doors/windows depending vendor | Depends on source plan quality; Archilogic cites +/-5% for rasterized plans with dimensions | Lowest friction when user already has plan | Best MVP/V2 lane |

## Floor-Plan Parsing APIs

This is the most realistic path for Ritzy's web-first product because many Dubai villa/townhouse users are likely to have developer floor plans for the whole home.

### Tectly

Tectly claims it can read rooms, walls, measurements, doors, windows, labels, and more from PDFs, raster images, and CAD formats. It also advertises browser editing, structured exports such as CSV/JSON, CAD exports, and a Cloud API.

Ritzy use:

- Strong candidate for a V2 parsing pilot.
- Fits the whole-home floor-plan case.
- Still requires a human review UI before using dimensions for furniture fit.

Source: https://tectly.com/en/

### Archilogic

Archilogic supports floor-plan conversion from JPG, PNG, PDF, DXF, and DWG into a digital model. Its SDK can render floor plans and expose room display options such as area or bounding-box dimensions. Archilogic states a target of +/-5% for models converted from rasterized floor-plan images with dimensions. It also notes that structural objects such as walls, doors, and windows are not exposed in Space API at the moment, though this is on the roadmap.

Ritzy use:

- Useful if Ritzy wants a maintained spatial model and floor-plan SDK.
- Less ideal if the immediate need is direct programmatic access to doors/windows from the API.
- Accuracy may be acceptable for planning, but tight furniture fits still need confirmation.

Sources:

- https://help.archilogic.com/knowledge/upload-a-floor-plan
- https://help.archilogic.com/knowledge/model-structure
- https://developers.archilogic.com/floor-plan-engine/v3/api

### Other Emerging Options

There are several newer or smaller floor-plan recognition tools claiming PDF/image parsing, including FloorScan, Measure Square AI, RasterScan, and Qvintos. These are worth watching, but should be treated as vendor-validation candidates rather than architectural dependencies until API terms, data retention, accuracy evidence, and export quality are proven.

Sources:

- https://floorscan.ai/
- https://ai.measuresquare.com/
- https://www.rasterscan.com/
- https://qvintos.com/

## Accuracy Expectations

For furniture fit, the relevant accuracy is not total square footage. It is whether the specific sofa, dining table, bed, rug, or console fits with usable clearance.

Practical tiers:

1. Manual laser measurement: best trust for key fit dimensions.
2. Professional LiDAR/as-built services such as Canvas: strong, but higher friction/cost.
3. Native LiDAR room scans such as RoomPlan, RoomScan, Polycam, magicplan, CubiCasa: useful, but should be reviewed and corrected.
4. Existing floor-plan parsing: good when the source plan is clean, scaled, and dimensioned; weaker when the image is distorted, low-res, unlabeled, or not as-built.
5. Photo-only estimation: not recommended.

Threshold rule:

- If a recommended product has generous clearance, estimates may be acceptable with a warning.
- If clearance is tight, ask for verified measurement before presenting it as safe to buy.

## Privacy And Security Concerns

Room plans are sensitive. They reveal home layout, entry points, windows, doors, room usage, and sometimes possessions or family routines.

Ritzy should treat measurement assets as high-sensitivity user data:

- Store only what is needed for the design workflow.
- Avoid public or shareable URLs by default.
- Use short-lived signed URLs for plan images and scan assets.
- Separate raw uploads from extracted structured measurements.
- Allow deletion of floor plans and scans.
- Do not send plans to third-party parsers without explicit disclosure.
- For third-party APIs, verify data retention, training usage, region, SOC 2/ISO posture, GDPR/DPA support, and whether scans are used to improve models.
- Avoid exposing full-house plans to retailers; only pass product quantities/SKUs and non-sensitive room context.

magicplan publicly references SOC 2, ISO/IEC 27001, and GDPR-aligned measures. Matterport advertises enterprise security and SSO/audit-log options. Canvas, CubiCasa, Polycam, and parsing vendors still need vendor-specific review before production integration.

Sources:

- https://help.magicplan.app/data-privacy-information-security
- https://matterport.com/plans?lang=en

## Dubai Villas And Townhouses

Most realistic for Ritzy:

- Developer PDF floor plans for villa/townhouse units.
- Whole-home plans rather than standalone room plans.
- Multi-floor layouts.
- Large rooms with sliding doors, window walls, built-ins, stair voids, and irregular open-plan living/dining areas.

Implications:

- MVP should support whole-home plan upload and room selection.
- The UI should allow the user to crop/select one room from a larger plan.
- The parser should not assume simple rectangular rooms.
- For open-plan living/dining, Ritzy should ask the user to mark the design zone.
- Ceiling height may not appear on floor plans, so ask separately where it affects curtains, pendants, tall storage, or feature walls.
- Doors/windows matter for furniture placement and should be captured as editable constraints, even if parsed automatically.

## MVP Recommendation

Build this into the web app:

1. Floor plan upload remains optional but encouraged.
2. Accept PDF, JPG, PNG, and possibly SVG.
3. Ask whether the upload is a whole-home plan or room-only plan.
4. Let the user select the room or design zone.
5. Extract visible room label and printed dimensions if possible.
6. Ask the user to confirm:
   - length
   - width
   - ceiling height
   - main entrance/door swing
   - windows/sliding doors
   - immovable built-ins
7. If no plan exists, show a manual measurement flow.
8. Store measurement confidence:
   - user_verified
   - parsed_from_plan
   - imported_from_scan
   - estimated_unverified
9. Use confidence in product matching and shopping-list warnings.

MVP should not require native scanning or external app installation.

## V2 Recommendation

Add integrations and parsing:

1. Pilot Tectly for PDF/image plan parsing.
2. Evaluate Archilogic if Ritzy needs a floor-plan SDK/spatial model, not just extracted measurements.
3. Add import support for common outputs:
   - magicplan: PDF/SVG/DXF/CSV/IFC
   - RoomScan: XML/IFC/DXF/CSV/PDF
   - Polycam: PDF/DXF/SVG/CSV
   - CubiCasa: PDF/SVG/JPG/PNG and API/SDK if partnership makes sense
   - Canvas: PDF/XLS reports, DWG/CAD where designer-led
4. Add a room-plan review screen with editable walls, doors, windows, and dimensions.

V2 goal: reduce manual entry while keeping the user in control of fit-critical data.

## Native-App Future Recommendation

Start with iOS:

- Apple RoomPlan is the best native foundation for structured room capture.
- It can identify walls, doors, windows, openings, and room components.
- It produces USD/USDZ exports with dimensions.
- It is aligned with a high-end Dubai customer base more likely to have newer iPhones.

Android:

- Do not build a custom ARCore Depth scanner as the first Android measurement feature.
- ARCore Depth provides depth maps, not a complete semantic room-plan solution.
- Use a partner SDK/workflow first, especially CubiCasa or magicplan, if Android capture becomes important.

## Final Decision

Use a trust-layered measurement strategy:

1. MVP: browser floor-plan upload, room selection, OCR/parsing assist, and mandatory confirmation of fit-critical dimensions.
2. V2: floor-plan parsing API pilot plus third-party scan/export imports.
3. Native future: iOS RoomPlan capture as the first owned scanning experience.

This gives Ritzy a low-friction web experience today without overclaiming measurement accuracy, and it creates a clear path to richer native capture later.

## Sources

- Apple RoomPlan overview: https://developer.apple.com/augmented-reality/roomplan/
- Apple RoomPlan documentation: https://developer.apple.com/documentation/roomplan
- Apple RoomPlan research note: https://machinelearning.apple.com/research/roomplan
- Google ARCore Depth: https://developers.google.com/ar/develop/depth
- ARCore Raw Depth codelab: https://codelabs.developers.google.com/codelabs/arcore-rawdepthapi
- Matterport APIs overview: https://matterport.github.io/developer-docs/api/
- Matterport dimension estimates: https://matterport.github.io/showcase-sdk/modelapi_pi_dimension_estimates.html
- Matterport pricing: https://matterport.com/plans?lang=en
- magicplan integrations: https://magicplan.app/integrations
- magicplan export formats: https://help.magicplan.app/export-formats
- magicplan accuracy note: https://help.magicplan.app/migration/how-accurate-is-magicplan
- magicplan security/privacy: https://help.magicplan.app/data-privacy-information-security
- RoomScan export formats: https://www.locometric.com/roomscan-export-formats
- RoomScan LiDAR: https://www.locometric.com/lidar
- CubiCasa App Store listing: https://apps.apple.com/us/app/cubicasa-2d-3d-floor-plans/id1439879192
- CubiCasa Conversion API docs: https://conversion.docs.cubi.casa/
- CubiCasa Integrate API docs: https://integrate.docs.cubi.casa/
- ARMLS note on CubiCasa accuracy: https://armls.com/how-accurate-are-cubicasa-floorplan-scans
- Canvas main site: https://canvas.io/
- Canvas service/pricing: https://services.canvas.io/
- Canvas Scan To CAD FAQ: https://support.canvas.io/article/12-what-is-scan-to-cad
- Canvas Measurement Report: https://canvas.io/features/measurement-report/
- Polycam floor plans: https://poly.cam/floor-plans
- Polycam pricing: https://poly.cam/pricing
- Polycam export formats: https://learn.poly.cam/hc/en-us/articles/27756102599572-What-File-Types-Can-Polycam-Export
- KIRI Engine pricing: https://www.kiriengine.app/Pricing
- KIRI Engine export formats: https://www.kiriengine.app/faq/what-kind-of-file-formats-can-kiri-engine-export
- Tectly floor-plan parsing: https://tectly.com/en/
- Archilogic floor-plan conversion: https://help.archilogic.com/knowledge/upload-a-floor-plan
- Archilogic model structure: https://help.archilogic.com/knowledge/model-structure
- Archilogic Floor Plan SDK: https://developers.archilogic.com/floor-plan-engine/v3/api
- FloorScan: https://floorscan.ai/
- Measure Square AI demo: https://ai.measuresquare.com/
- RasterScan: https://www.rasterscan.com/
- Qvintos: https://qvintos.com/

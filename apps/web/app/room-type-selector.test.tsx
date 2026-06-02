import assert from "node:assert/strict";

import { roomCreationRoomTypes } from "@ritzy-studio/domain";
import { renderToStaticMarkup } from "react-dom/server";

import { RoomTypeSelector } from "./projects/[projectId]/rooms/new/room-type-selector";

const html = renderToStaticMarkup(<RoomTypeSelector roomTypes={roomCreationRoomTypes} />);

for (const roomType of ["Living Room", "Dining Room", "Bedroom", "Home Office", "Living & Dining"]) {
  assert.equal(html.includes(`value="${escapeHtml(roomType)}"`), true, `${roomType} radio value should render`);
  assert.equal(html.includes(`>${escapeHtml(roomType)}<`), true, `${roomType} label should render`);
}

assert.equal((html.match(/name="roomType"/g) ?? []).length, roomCreationRoomTypes.length);
assert.equal(html.includes('type="radio"'), true);

console.log("room type selector tests passed");

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;");
}

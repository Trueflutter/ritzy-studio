import assert from "node:assert/strict";

import { roomCreationRoomTypes } from "@ritzy-studio/domain";
import { renderToStaticMarkup } from "react-dom/server";

import { RoomTypeSelector } from "./projects/[projectId]/rooms/new/room-type-selector";

const html = renderToStaticMarkup(<RoomTypeSelector roomTypes={roomCreationRoomTypes} />);
const combinedIndex = html.indexOf('value="Living &amp; Dining"');

for (const roomType of ["Living Room", "Dining Room", "Bedroom", "Home Office", "Living & Dining"]) {
  assert.equal(html.includes(`value="${escapeHtml(roomType)}"`), true, `${roomType} radio value should render`);
}

assert.equal(combinedIndex > -1, true, "Living & Dining radio should render");
assert.equal(combinedIndex < html.indexOf('value="Living Room"'), true, "combined hall should render first");
assert.equal(html.includes(">Living Room + Dining Room (Hall)<"), true, "combined hall label should render");
assert.equal(html.includes("sm:col-span-2"), true, "combined hall option should span both columns");
assert.equal(html.includes(">Living Room<"), true, "Living Room label should render");
assert.equal(html.includes(">Dining Room<"), true, "Dining Room label should render");
assert.equal(html.includes(">Bedroom<"), true, "Bedroom label should render");
assert.equal(html.includes(">Home Office<"), true, "Home Office label should render");
assert.equal((html.match(/name="roomType"/g) ?? []).length, roomCreationRoomTypes.length);
assert.equal(html.includes('type="radio"'), true);

console.log("room type selector tests passed");

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;");
}

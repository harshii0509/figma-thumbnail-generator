"use strict";
// src/code/index.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Show the UI when the plugin runs (make it visible so the user can edit)
figma.showUI(__html__, { width: 300, height: 250 });
// Listen for messages from the UI
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    if (msg.type === 'update-thumbnail') {
        const { heading, description } = msg;
        yield updateThumbnailCanvas(heading, description);
    }
});
function updateThumbnailCanvas(heading, description) {
    return __awaiter(this, void 0, void 0, function* () {
        // Load fonts
        yield figma.loadFontAsync({ family: "Roboto", style: "Bold" });
        yield figma.loadFontAsync({ family: "Roboto", style: "Regular" });
        // Create a new frame (canvas) for the thumbnail
        const canvasFrame = figma.createFrame();
        canvasFrame.resize(400, 300);
        canvasFrame.name = "Thumbnail Canvas";
        canvasFrame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
        figma.currentPage.appendChild(canvasFrame);
        // Create heading text node
        const headingText = figma.createText();
        headingText.characters = heading || "Default Heading";
        headingText.fontSize = 24;
        headingText.fontName = { family: "Roboto", style: "Bold" };
        headingText.x = 20;
        headingText.y = 20;
        canvasFrame.appendChild(headingText);
        // Create description text node
        const descriptionText = figma.createText();
        descriptionText.characters = description || "Default description...";
        descriptionText.fontSize = 16;
        descriptionText.fontName = { family: "Roboto", style: "Regular" };
        descriptionText.x = 20;
        // Position the description below the heading with a 10px margin
        descriptionText.y = headingText.y + headingText.height + 10;
        canvasFrame.appendChild(descriptionText);
    });
}

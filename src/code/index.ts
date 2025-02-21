// Show the UI. If you bundled the UI as HTML, replace __html__ with the correct reference
figma.showUI(__html__, { width: 320, height: 640 }); // Increased height to show preview and all controls

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
}

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'generate-thumbnail') {
    const { heading, description, styles } = msg;
    await createThumbnailCanvas(heading, description, styles);
  }
};

async function createThumbnailCanvas(
  heading: string, 
  description: string, 
  styles: {
    heading: { font: string; weight: string; size: number; color: string; position: string };
    description: { font: string; weight: string; size: number; color: string; position: string } | null;
    background: { color: string; gradient: boolean };
  }
) {
  // Load fonts first
  await figma.loadFontAsync({ family: styles.heading.font, style: styles.heading.weight });
  if (styles.description) {
    await figma.loadFontAsync({ family: styles.description.font, style: styles.description.weight });
  }

  // Create frame and set background
  const frame = figma.createFrame();
  frame.resize(1920, 1080);
  frame.name = 'Thumbnail Canvas';
  
  // Set background color and gradient
  frame.fills = [{ type: 'SOLID', color: hexToRgb(styles.background.color) }];
  if (styles.background.gradient) {
    frame.fills = [
      ...frame.fills,
      {
        type: 'GRADIENT_LINEAR',
        gradientTransform: [[1, 0, 0], [0, 1, 0]],
        gradientStops: [
          { position: 0, color: { r: 0, g: 0, b: 0, a: 0 } },
          { position: 1, color: { r: 0, g: 0, b: 0, a: 0.7 } }
        ]
      }
    ];
  }
  figma.currentPage.appendChild(frame);

  // Create text nodes first and set their content/styles
  const headingText = figma.createText();
  headingText.characters = heading;
  headingText.fontSize = styles.heading.size;
  headingText.fontName = { family: styles.heading.font, style: styles.heading.weight };
  headingText.fills = [{ type: 'SOLID', color: hexToRgb(styles.heading.color) }];
  headingText.resize(frame.width - 320, headingText.height);
  headingText.textAutoResize = 'HEIGHT';
  frame.appendChild(headingText);

  let descriptionText = null;
  if (description && styles.description) {
    descriptionText = figma.createText();
    descriptionText.characters = description;
    descriptionText.fontSize = styles.description.size;
    descriptionText.fontName = { family: styles.description.font, style: styles.description.weight };
    descriptionText.fills = [{ type: 'SOLID', color: hexToRgb(styles.description.color) }];
    descriptionText.resize(frame.width - 320, descriptionText.height);
    descriptionText.textAutoResize = 'HEIGHT';
    frame.appendChild(descriptionText);
  }

  // Calculate positions after text nodes are created and sized
  let yPos;
  switch(styles.heading.position) {
    case 'top':
      yPos = 120; // Safe space from top
      break;
    case 'middle':
      yPos = (frame.height - headingText.height - (descriptionText ? descriptionText.height + 24 : 0)) / 2;
      break;
    case 'bottom':
      yPos = frame.height - 120 - headingText.height - (descriptionText ? descriptionText.height + 24 : 0);
      break;
    default:
      yPos = frame.height - 120 - headingText.height - (descriptionText ? descriptionText.height + 24 : 0);
  }

  // Position the elements
  if (styles.description?.position === 'above-heading' && descriptionText) {
    descriptionText.x = 160;
    descriptionText.y = yPos;
    headingText.x = 160;
    headingText.y = descriptionText.y + descriptionText.height + 24;
  } else {
    headingText.x = 160;
    headingText.y = yPos;
    if (descriptionText) {
      descriptionText.x = 160;
      descriptionText.y = headingText.y + headingText.height + 24;
    }
  }

  figma.viewport.scrollAndZoomIntoView([frame]);
  figma.closePlugin();
}

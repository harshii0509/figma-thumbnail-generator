// Show the UI. If you bundled the UI as HTML, replace __html__ with the correct reference
figma.showUI(__html__, { width: 320, height: 640 }); // Increased height to show preview and all controls

// Add constants for safe space at the top of the file
const SAFE_SPACE = {
  horizontal: 160,  // Left and right padding
  vertical: 120     // Top and bottom padding
};

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
  } else if (msg.type === 'generate-ai-thumbnail') {
    try {
      const response = await generateAIThumbnail(msg.prompt, msg.includeBackground);
      figma.ui.postMessage({
        type: 'ai-generation-complete',
        ...response
      });
    } catch (error) {
      figma.ui.postMessage({
        type: 'ai-generation-error',
        error: error.message
      });
    }
  }
};

// Update the createThumbnailCanvas function's type definition
type TagStyle = {
  text: string;
  position: string;
  fillColor: string;
  textColor: string;
  radius: number;
  fontSize: number;
  fontWeight: string;
}

type Contributor = {
  name: string;
  avatarUrl: string;
}

type Styles = {
  heading: { font: string; weight: string; size: number; color: string; position: string };
  description: { font: string; weight: string; size: number; color: string; position: string } | null;
  background: { color: string; gradient: boolean };
  tags: TagStyle[] | null;
  contributors?: {
    items: Contributor[];
    displayMode: 'avatars-only' | 'names-only' | 'both';
  };
}

// Add these type definitions
type AIGenerationResponse = {
  heading: string;
  description: string;
  backgroundColor?: string;
  backgroundImage?: Uint8Array;
}

async function createThumbnailCanvas(
  heading: string, 
  description: string, 
  styles: Styles
) {
  // Load fonts first
  try {
    // Load Inter font as fallback if specified font fails
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    
    // Try to load specified fonts
    await figma.loadFontAsync({ family: styles.heading.font, style: styles.heading.weight });
    if (styles.description) {
      await figma.loadFontAsync({ family: styles.description.font, style: styles.description.weight });
    }
  } catch (error) {
    console.error("Font loading error:", error);
    // Use Inter as fallback
    styles.heading.font = "Inter";
    if (styles.description) {
      styles.description.font = "Inter";
    }
  }

  // Create frame and set background
  const frame = figma.createFrame();
  frame.resize(1920, 1080);
  frame.name = 'Thumbnail Canvas';
  
  // Calculate the maximum width for content within safe space
  const maxContentWidth = frame.width - (SAFE_SPACE.horizontal * 2);

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

  // Create heading text
  const headingText = figma.createText();
  await figma.loadFontAsync({ family: styles.heading.font, style: styles.heading.weight });
  headingText.fontName = { family: styles.heading.font, style: styles.heading.weight };
  headingText.characters = heading;
  headingText.fontSize = styles.heading.size;
  headingText.fills = [{ type: 'SOLID', color: hexToRgb(styles.heading.color) }];
  headingText.textAutoResize = 'HEIGHT';
  headingText.resize(maxContentWidth, headingText.height);
  headingText.x = SAFE_SPACE.horizontal;
  frame.appendChild(headingText);

  // Create description text if provided
  let descriptionText = null;
  if (description && styles.description) {
    descriptionText = figma.createText();
    await figma.loadFontAsync({ family: styles.description.font, style: styles.description.weight });
    descriptionText.fontName = { family: styles.description.font, style: styles.description.weight };
    descriptionText.characters = description;
    descriptionText.fontSize = styles.description.size;
    descriptionText.fills = [{ type: 'SOLID', color: hexToRgb(styles.description.color) }];
    descriptionText.textAutoResize = 'HEIGHT';
    descriptionText.resize(maxContentWidth, descriptionText.height);
    descriptionText.x = SAFE_SPACE.horizontal;
    frame.appendChild(descriptionText);
  }

  // Calculate positions within safe space
  let yPos;
  switch(styles.heading.position) {
    case 'top':
      yPos = SAFE_SPACE.vertical;
      break;
    case 'middle':
      yPos = (frame.height - headingText.height - (descriptionText ? descriptionText.height + 24 : 0)) / 2;
      break;
    case 'bottom':
      yPos = frame.height - SAFE_SPACE.vertical - headingText.height - (descriptionText ? descriptionText.height + 24 : 0);
      break;
    default:
      yPos = frame.height - SAFE_SPACE.vertical - headingText.height - (descriptionText ? descriptionText.height + 24 : 0);
  }

  // Position elements
  if (styles.description?.position === 'above-heading' && descriptionText) {
    descriptionText.x = SAFE_SPACE.horizontal;
    descriptionText.y = yPos;
    headingText.x = SAFE_SPACE.horizontal;
    headingText.y = descriptionText.y + descriptionText.height + 24;
  } else {
    headingText.x = SAFE_SPACE.horizontal;
    headingText.y = yPos;
    if (descriptionText) {
      descriptionText.x = SAFE_SPACE.horizontal;
      descriptionText.y = headingText.y + headingText.height + 24;
    }
  }

  // Update the tag creation section
  if (styles.tags && styles.tags.length > 0) {
    const tagSpacing = 12;
    let currentX = SAFE_SPACE.horizontal;
    
    for (const tagStyle of styles.tags) {
      if (!tagStyle.text) continue;

      // Create container frame for the tag
      const tagFrame = figma.createFrame();
      tagFrame.name = `Tag - ${tagStyle.text}`;
      
      // Create the text node
      const tagText = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: tagStyle.fontWeight });
      tagText.fontName = { family: "Inter", style: tagStyle.fontWeight };
      tagText.characters = tagStyle.text;
      tagText.fontSize = tagStyle.fontSize;
      tagText.fills = [{ type: 'SOLID', color: hexToRgb(tagStyle.textColor) }];
      
      // Add text to frame and set frame properties
      tagFrame.appendChild(tagText);
      tagFrame.fills = [{ type: 'SOLID', color: hexToRgb(tagStyle.fillColor) }];
      tagFrame.cornerRadius = tagStyle.radius;
      
      // Set frame size with padding
      const padding = 12;
      tagFrame.resize(
        tagText.width + (padding * 2),
        tagText.height + (padding * 2)
      );
      
      // Center text in frame
      tagText.x = padding;
      tagText.y = padding;
      
      // Update tag positioning within safe space
      tagFrame.x = currentX;
      switch(tagStyle.position) {
        case 'top':
          tagFrame.y = SAFE_SPACE.vertical;
          break;
        case 'above-heading':
          tagFrame.y = headingText.y - tagFrame.height - 40;
          break;
        case 'bottom':
          tagFrame.y = frame.height - SAFE_SPACE.vertical - tagFrame.height;
          break;
      }
      
      // Check if tag would exceed safe space width
      if (currentX + tagFrame.width + tagSpacing > frame.width - SAFE_SPACE.horizontal) {
        // Move to next row
        currentX = SAFE_SPACE.horizontal;
        tagFrame.x = currentX;
        tagFrame.y += tagFrame.height + tagSpacing;
      }
      
      currentX += tagFrame.width + tagSpacing;
      frame.appendChild(tagFrame);
    }
  }

  // Handle contributors
  if (styles.contributors && styles.contributors.items && styles.contributors.items.length > 0) {
    const avatarSize = 40;
    const spacing = 8;
    const padding = 20;
    const safeSpace = 120;
    const contributorSpacing = 12;
    
    // Create main container for all contributors
    const contributorsContainer = figma.createFrame();
    contributorsContainer.name = 'Contributors Container';
    contributorsContainer.layoutMode = 'HORIZONTAL';
    contributorsContainer.counterAxisAlignItems = 'CENTER';
    contributorsContainer.itemSpacing = contributorSpacing;
    contributorsContainer.fills = [];
    contributorsContainer.x = SAFE_SPACE.horizontal;

    // Position container within safe space
    if (styles.heading.position === 'bottom') {
      const topElementY = styles.description?.position === 'above-heading' 
        ? descriptionText?.y || headingText.y 
        : headingText.y;
      contributorsContainer.y = Math.max(
        SAFE_SPACE.vertical,
        topElementY - contributorsContainer.height - 40
      );
    } else {
      contributorsContainer.y = frame.height - SAFE_SPACE.vertical - contributorsContainer.height;
    }

    for (const contributor of styles.contributors.items) {
      // Create container for individual contributor
      const contributorFrame = figma.createFrame();
      contributorFrame.name = `Contributor - ${contributor.name || 'Anonymous'}`;
      contributorFrame.layoutMode = 'HORIZONTAL';
      contributorFrame.counterAxisAlignItems = 'CENTER';
      contributorFrame.itemSpacing = spacing;
      contributorFrame.fills = [];
      contributorFrame.paddingLeft = 0;
      contributorFrame.paddingRight = 0;

      if (styles.contributors.displayMode !== 'names-only') {
        try {
          const response = await fetch(contributor.avatarUrl);
          const arrayBuffer = await response.arrayBuffer();
          const avatarData = new Uint8Array(arrayBuffer);
          
          const avatarImage = figma.createImage(avatarData);
          const avatarFill: Paint = {
            type: 'IMAGE',
            scaleMode: 'FILL',
            imageHash: avatarImage.hash
          };
          
          const avatarFrame = figma.createFrame();
          avatarFrame.resize(avatarSize, avatarSize);
          avatarFrame.cornerRadius = avatarSize / 2;
          avatarFrame.fills = [avatarFill];
          contributorFrame.appendChild(avatarFrame);
        } catch (error) {
          console.error('Error loading avatar:', error);
          const avatarFrame = figma.createFrame();
          avatarFrame.resize(avatarSize, avatarSize);
          avatarFrame.cornerRadius = avatarSize / 2;
          avatarFrame.fills = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
          contributorFrame.appendChild(avatarFrame);
        }
      }

      if (styles.contributors.displayMode !== 'avatars-only' && contributor.name) {
        const nameText = figma.createText();
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        nameText.fontName = { family: "Inter", style: "Regular" };
        nameText.characters = contributor.name;
        nameText.fontSize = 16;
        nameText.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
        contributorFrame.appendChild(nameText);
      }

      contributorsContainer.appendChild(contributorFrame);
    }

    // Auto-wrap to new rows if container is too wide
    if (contributorsContainer.width > maxContentWidth) {
      const wrapperContainer = figma.createFrame();
      wrapperContainer.name = 'Contributors Wrapper';
      wrapperContainer.layoutMode = 'VERTICAL';
      wrapperContainer.itemSpacing = spacing;
      wrapperContainer.fills = [];
      wrapperContainer.x = SAFE_SPACE.horizontal;
      wrapperContainer.y = contributorsContainer.y;

      let currentRow = figma.createFrame();
      currentRow.layoutMode = 'HORIZONTAL';
      currentRow.counterAxisAlignItems = 'CENTER';
      currentRow.itemSpacing = contributorSpacing;
      currentRow.fills = [];
      
      let currentRowWidth = 0;
      
      for (const contributorFrame of contributorsContainer.children) {
        const wouldExceedWidth = currentRowWidth + contributorFrame.width + contributorSpacing > maxContentWidth;
        
        if (wouldExceedWidth && currentRow.children.length > 0) {
          wrapperContainer.appendChild(currentRow);
          currentRow = figma.createFrame();
          currentRow.layoutMode = 'HORIZONTAL';
          currentRow.counterAxisAlignItems = 'CENTER';
          currentRow.itemSpacing = contributorSpacing;
          currentRow.fills = [];
          currentRowWidth = 0;
        }
        
        currentRow.appendChild(contributorFrame);
        currentRowWidth += contributorFrame.width + contributorSpacing;
      }
      
      if (currentRow.children.length > 0) {
        wrapperContainer.appendChild(currentRow);
      }

      frame.appendChild(wrapperContainer);
    } else {
      frame.appendChild(contributorsContainer);
    }
  }

  figma.viewport.scrollAndZoomIntoView([frame]);
  figma.closePlugin();
}

// Add this function to handle AI generation
async function generateAIThumbnail(prompt: string, includeBackground: boolean): Promise<AIGenerationResponse> {
  // You'll need to implement the actual API calls to OpenAI here
  // This is a placeholder for the API integration
  try {
    // Generate heading and description using GPT-4
    const contentResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_OPENAI_API_KEY'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: 'You are a thumbnail content generator. Generate a compelling heading and description for thumbnails.'
        }, {
          role: 'user',
          content: `Generate a thumbnail heading (max 50 chars) and description (max 120 chars) for: ${prompt}`
        }],
        temperature: 0.7
      })
    });

    const contentData = await contentResponse.json();
    const [heading, description] = contentData.choices[0].message.content.split('\n');

    let backgroundColor = '#FFFFFF';
    let backgroundImage: Uint8Array | undefined;

    if (includeBackground) {
      // Generate background image using DALL-E 3
      const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_OPENAI_API_KEY'
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: `Generate a subtle, professional background image for a thumbnail with the heading: ${heading}`,
          size: '1792x1024',
          quality: 'standard',
          n: 1
        })
      });

      const imageData = await imageResponse.json();
      const imageUrl = imageData.data[0].url;

      // Download the generated image
      const imageDownload = await fetch(imageUrl);
      const arrayBuffer = await imageDownload.arrayBuffer();
      backgroundImage = new Uint8Array(arrayBuffer);
    }

    return {
      heading,
      description,
      backgroundColor,
      backgroundImage
    };
  } catch (error) {
    console.error('AI Generation Error:', error);
    throw new Error('Failed to generate thumbnail content');
  }
}

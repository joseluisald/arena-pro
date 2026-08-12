import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Helper to convert any oklch(...) occurrences in a CSS style string to browser-computed rgb/rgba values
 */
function convertOklchInString(str: string): string {
  if (!str || !str.includes('oklch')) return str;
  return str.replace(/oklch\([^)]+\)/gi, (match) => {
    try {
      const dummy = document.createElement('div');
      dummy.style.color = match;
      document.body.appendChild(dummy);
      const computed = window.getComputedStyle(dummy).color;
      document.body.removeChild(dummy);
      if (computed && !computed.includes('oklch') && computed !== '') {
        return computed;
      }
    } catch (e) {}
    return 'rgb(120, 120, 120)';
  });
}

/**
 * Sanitizes cloned document for html2canvas by replacing all <style> and <link> tags
 * containing oklch() with clean <style> tags using converted rgb/rgba colors.
 */
function sanitizeClonedDocForCanvas(clonedDoc: Document) {
  // 1. Convert all <style> tags
  try {
    const styleTags = Array.from(clonedDoc.querySelectorAll('style'));
    styleTags.forEach((styleTag) => {
      const originalText = styleTag.textContent || '';
      if (originalText.includes('oklch')) {
        const convertedText = convertOklchInString(originalText);
        const newStyle = clonedDoc.createElement('style');
        newStyle.textContent = convertedText;
        if (styleTag.parentNode) {
          styleTag.parentNode.replaceChild(newStyle, styleTag);
        }
      }
    });
  } catch (e) {}

  // 2. Convert all <link rel="stylesheet"> tags into inline <style> tags without oklch
  try {
    const linkTags = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]'));
    linkTags.forEach((link) => {
      try {
        const href = (link as HTMLLinkElement).href;
        for (let i = 0; i < document.styleSheets.length; i++) {
          const sheet = document.styleSheets[i];
          if (sheet.href === href) {
            let cssText = '';
            try {
              const rules = sheet.cssRules || sheet.rules;
              for (let j = 0; j < rules.length; j++) {
                cssText += rules[j].cssText + '\n';
              }
            } catch (ruleErr) {}

            if (cssText) {
              const newStyle = clonedDoc.createElement('style');
              newStyle.textContent = convertOklchInString(cssText);
              if (link.parentNode) {
                link.parentNode.replaceChild(newStyle, link);
              }
            }
            break;
          }
        }
      } catch (linkErr) {}
    });
  } catch (e) {}

  // 3. Convert any inline style attributes with oklch
  try {
    const elementsWithInlineStyle = clonedDoc.querySelectorAll('[style*="oklch"]');
    elementsWithInlineStyle.forEach((node) => {
      if (node instanceof HTMLElement || node instanceof SVGElement) {
        const el = node as HTMLElement;
        if (el.style && el.style.cssText && el.style.cssText.includes('oklch')) {
          el.style.cssText = convertOklchInString(el.style.cssText);
        }
      }
    });
  } catch (e) {}
}

/**
 * Captures an HTML element and downloads it as a PNG image for feeds/social media
 */
export async function exportElementAsImage(
  elementId: string, 
  filename: string = 'confrontos-feed.png',
  bgColor: string = '#FFFFFF'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id '${elementId}' not found.`);
  }

  const canvas = await html2canvas(element, {
    scale: 2, // High resolution for Retina/Feed
    useCORS: true,
    allowTaint: true,
    backgroundColor: bgColor,
    logging: false,
    onclone: (clonedDoc) => {
      sanitizeClonedDocForCanvas(clonedDoc);
    },
  });

  const image = canvas.toDataURL('image/png', 1.0);
  const link = document.createElement('a');
  link.href = image;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Captures an HTML element and compiles it into a downloadable multi-page PDF
 */
export async function exportElementAsPdf(elementId: string, filename: string = 'confrontos.pdf'): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id '${elementId}' not found.`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#FFFFFF',
    logging: false,
    onclone: (clonedDoc) => {
      sanitizeClonedDocForCanvas(clonedDoc);
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}

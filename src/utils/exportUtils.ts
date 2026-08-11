import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Helper to convert any oklch(...) occurrences in a CSS style string to browser-computed rgb/rgba values or a safe fallback
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
      if (computed && !computed.includes('oklch')) {
        return computed;
      }
    } catch (e) {}
    return 'rgba(128, 128, 128, 0.5)';
  });
}

/**
 * Sanitizes cloned document for html2canvas by converting all oklch() colors to standard rgb/rgba/hex
 */
function sanitizeClonedDocForCanvas(clonedDoc: Document) {
  // 1. Replace oklch inside <style> tags
  try {
    const styleTags = clonedDoc.querySelectorAll('style');
    styleTags.forEach((styleTag) => {
      if (styleTag.textContent && styleTag.textContent.includes('oklch')) {
        styleTag.textContent = convertOklchInString(styleTag.textContent);
      }
    });
  } catch (e) {}

  // 2. Process elements and computed styles
  try {
    const allElements = clonedDoc.querySelectorAll('*');
    const colorProps = [
      'color',
      'backgroundColor',
      'borderColor',
      'borderTopColor',
      'borderRightColor',
      'borderBottomColor',
      'borderLeftColor',
      'outlineColor',
      'fill',
      'stroke',
    ];

    allElements.forEach((node) => {
      if (!(node instanceof HTMLElement || node instanceof SVGElement)) return;
      const el = node as HTMLElement;

      // Check inline style cssText
      if (el.style && el.style.cssText && el.style.cssText.includes('oklch')) {
        el.style.cssText = convertOklchInString(el.style.cssText);
      }

      // Check computed styles
      try {
        const computed = window.getComputedStyle(el);
        colorProps.forEach((prop) => {
          const val = computed.getPropertyValue(prop.replace(/([A-Z])/g, '-$1').toLowerCase());
          if (val && val.includes('oklch')) {
            const converted = convertOklchInString(val);
            (el.style as any)[prop] = converted;
          }
        });

        const boxShadow = computed.boxShadow;
        if (boxShadow && boxShadow.includes('oklch')) {
          el.style.boxShadow = convertOklchInString(boxShadow);
        }
      } catch (e) {}
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
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
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

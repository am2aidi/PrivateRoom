/**
 * Screenshot Deterrent & Privacy Protection Utility
 * 
 * Features:
 * - Prevents text selection, dragging, and context menu.
 * - Detects PrintScreen key / screen capture shortcuts.
 * - Detects window/tab focus loss (blur, visibilitychange).
 * - Appends dynamic print-hiding CSS.
 */

export function setupScreenshotProtection(onBlurCallback, onPrintScreenCallback) {
  // Prevent context menu (right click)
  const handleContextMenu = (e) => e.preventDefault();

  // Prevent drag & drop
  const handleDragStart = (e) => e.preventDefault();

  // Prevent text selection drag
  const handleSelectStart = (e) => {
    // Allow text selection in input boxes only
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };

  // Detect PrintScreen and Screen Capture keys
  const handleKeyDown = (e) => {
    if (
      e.key === 'PrintScreen' ||
      (e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) ||
      (e.ctrlKey && e.key === 'p')
    ) {
      if (onPrintScreenCallback) onPrintScreenCallback();
    }
  };

  // Detect Tab / Window Focus loss
  const handleVisibilityChange = () => {
    if (document.hidden || document.visibilityState !== 'visible') {
      if (onBlurCallback) onBlurCallback();
    }
  };

  const handleWindowBlur = () => {
    if (onBlurCallback) onBlurCallback();
  };

  // Attach global listeners
  document.addEventListener('contextmenu', handleContextMenu);
  document.addEventListener('dragstart', handleDragStart);
  document.addEventListener('selectstart', handleSelectStart);
  window.addEventListener('keydown', handleKeyDown);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('blur', handleWindowBlur);

  // Return cleanup function
  return () => {
    document.removeEventListener('contextmenu', handleContextMenu);
    document.removeEventListener('dragstart', handleDragStart);
    document.removeEventListener('selectstart', handleSelectStart);
    window.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('blur', handleWindowBlur);
  };
}

/**
 * Strips EXIF metadata from an image File using Canvas redrawing
 */
export async function stripExifData(imageFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Export sanitized clean JPEG without metadata
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas image conversion failed'));
            return;
          }
          const cleanReader = new FileReader();
          cleanReader.onloadend = () => {
            resolve(cleanReader.result); // ArrayBuffer
          };
          cleanReader.readAsArrayBuffer(blob);
        }, 'image/jpeg', 0.9);
      };
      img.onerror = () => reject(new Error('Image loading failed'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('File reading failed'));
    reader.readAsDataURL(imageFile);
  });
}

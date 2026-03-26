/**
 * SiamClones — Client-side image optimization utilities
 * Resizes, compresses, and converts images before upload to Supabase Storage.
 * Dramatically reduces upload size and page load times on mobile.
 *
 * CRITICAL PATH: Payment proof uploads MUST succeed or customers lose money.
 * Every function here is defensive — always returns a usable file, never throws.
 */

import heic2any from 'heic2any';

/**
 * Detect if a file is HEIC/HEIF format (by MIME type or file extension).
 * Banking app screenshots and iOS photos may have missing/wrong MIME types,
 * so we check the extension as a fallback.
 */
function isHeicFile(file) {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();
  if (type.includes('heic') || type.includes('heif')) return true;
  const name = (file.name || '').toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

/**
 * Convert a HEIC/HEIF file to JPEG so it's web-displayable and email-safe.
 * Uses heic2any (WASM-based) for client-side conversion.
 *
 * GUARANTEES: Always resolves with a File. Never rejects.
 * If conversion fails or times out, returns the original file unchanged.
 *
 * @param {File} file - Original file (may or may not be HEIC)
 * @param {Object} options
 * @param {number} options.timeoutMs - Max time for conversion (default 15000ms)
 * @returns {Promise<File>} - JPEG File if converted, or original file
 */
export async function convertHeicToJpeg(file, { timeoutMs = 15000 } = {}) {
  if (!isHeicFile(file)) return file;

  const originalSize = (file.size / (1024 * 1024)).toFixed(1);
  console.log(`[HEIC] Converting: ${file.name} (${originalSize}MB)`);

  try {
    const conversionPromise = heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('HEIC conversion timed out')), timeoutMs)
    );

    const result = await Promise.race([conversionPromise, timeoutPromise]);

    // heic2any may return an array of blobs for multi-image HEIC — take the first
    const blob = Array.isArray(result) ? result[0] : result;

    if (!blob || blob.size === 0) {
      console.warn('[HEIC] Conversion returned empty blob, using original');
      return file;
    }

    const newName = (file.name || 'image').replace(/\.(heic|heif)$/i, '.jpg');
    const converted = new File([blob], newName, { type: 'image/jpeg' });

    const convertedSize = (converted.size / (1024 * 1024)).toFixed(1);
    console.log(`[HEIC] Converted: ${originalSize}MB → ${convertedSize}MB JPEG`);

    return converted;
  } catch (err) {
    console.warn('[HEIC] Conversion failed, uploading as-is:', err.message || err);
    return file;
  }
}

/**
 * Read EXIF orientation tag from a JPEG file's first 64KB.
 * Returns orientation value 1-8 (1 = normal, others = rotated/flipped).
 * Resolves with 1 if not JPEG, no EXIF, or any error.
 */
function getExifOrientation(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const view = new DataView(e.target.result);
        // Check JPEG SOI marker
        if (view.getUint16(0, false) !== 0xFFD8) return resolve(1);
        let offset = 2;
        while (offset < view.byteLength) {
          const marker = view.getUint16(offset, false);
          offset += 2;
          if (marker === 0xFFE1) {
            // APP1 marker — EXIF data
            offset += 2; // skip segment length
            if (view.getUint32(offset, false) !== 0x45786966) return resolve(1); // not "Exif"
            const little = view.getUint16(offset + 6, false) === 0x4949; // endianness
            const tiffOffset = offset + 6;
            const tags = view.getUint16(tiffOffset + 2, little);
            for (let i = 0; i < tags; i++) {
              const tagOffset = tiffOffset + 4 + i * 12;
              if (tagOffset + 12 > view.byteLength) return resolve(1);
              if (view.getUint16(tagOffset, little) === 0x0112) {
                return resolve(view.getUint16(tagOffset + 8, little));
              }
            }
            return resolve(1);
          }
          if ((marker & 0xFF00) !== 0xFF00) break;
          offset += view.getUint16(offset, false);
        }
        resolve(1);
      } catch {
        resolve(1);
      }
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
}

/**
 * Apply EXIF orientation transform to a canvas context.
 * Adjusts canvas dimensions and applies the correct rotation/flip
 * so the image draws upright regardless of how the camera recorded it.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} orientation - EXIF orientation value (1-8)
 * @param {number} width - Original image width
 * @param {number} height - Original image height
 * @returns {{ drawWidth: number, drawHeight: number }} - dimensions for drawImage
 */
function applyExifOrientation(ctx, orientation, width, height) {
  const canvas = ctx.canvas;

  // Orientations 5-8 swap width/height
  if (orientation >= 5) {
    canvas.width = height;
    canvas.height = width;
  } else {
    canvas.width = width;
    canvas.height = height;
  }

  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;           // flip horizontal
    case 3: ctx.transform(-1, 0, 0, -1, width, height); break;      // rotate 180
    case 4: ctx.transform(1, 0, 0, -1, 0, height); break;           // flip vertical
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;                 // transpose
    case 6: ctx.transform(0, 1, -1, 0, height, 0); break;           // rotate 90 CW
    case 7: ctx.transform(0, -1, -1, 0, height, width); break;      // transverse
    case 8: ctx.transform(0, -1, 1, 0, 0, width); break;            // rotate 90 CCW
    default: break; // orientation 1 = normal, no transform needed
  }

  return { drawWidth: width, drawHeight: height };
}

/**
 * Detect actual WebP encoding support (not just toBlob existence).
 * Caches result after first call.
 */
let _webpSupported = null;
function detectWebPEncode() {
  if (_webpSupported !== null) return _webpSupported;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    _webpSupported = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    _webpSupported = false;
  }
  return _webpSupported;
}

/**
 * Resize and compress an image file client-side before upload.
 * Returns a new File object that's optimized.
 *
 * GUARANTEES: Always resolves with a valid {file, width, height}.
 * Never rejects. If anything fails, returns the original file unchanged.
 *
 * @param {File} file - Original image file from input
 * @param {Object} options
 * @param {number} options.maxWidth - Max width in px (default 1200)
 * @param {number} options.maxHeight - Max height in px (default 1200)
 * @param {number} options.quality - JPEG/WebP quality 0-1 (default 0.82)
 * @param {string} options.format - Output format: 'image/webp' or 'image/jpeg' (default auto-detect)
 * @returns {Promise<{file: File, width: number, height: number}>}
 */
export async function optimizeImage(file, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.82,
    format = null,
  } = options;

  const fallback = { file, width: 0, height: 0 };

  try {
    // Skip non-image files
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return fallback;
    }

    // Skip SVGs — they don't need rasterization
    if (file.type === 'image/svg+xml') {
      return fallback;
    }

    // Skip tiny files (< 50KB) — not worth processing
    if (file.size < 50 * 1024) {
      return fallback;
    }

    // HEIC/HEIF: most browsers can't decode these via Image element.
    // Don't attempt canvas processing — just return the original.
    // The upload handler will convert HEIC to JPEG if needed.
    if (file.type === 'image/heic' || file.type === 'image/heif' ||
        file.name?.toLowerCase().endsWith('.heic') || file.name?.toLowerCase().endsWith('.heif')) {
      return fallback;
    }

    // Read EXIF orientation before loading into canvas (strips GPS/metadata via re-encode)
    const orientation = await getExifOrientation(file);

    return await new Promise((resolve) => {
      // Timeout: if image processing takes > 10s, bail with original file
      const timeout = setTimeout(() => {
        console.warn('[optimizeImage] Timed out after 10s, using original file');
        resolve(fallback);
      }, 10000);

      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);

        try {
          let { width, height } = img;

          // For orientations 5-8, the image is rotated 90/270 degrees
          // so we need to swap dimensions for correct aspect ratio calculation
          const swapped = orientation >= 5;
          let logicalW = swapped ? height : width;
          let logicalH = swapped ? width : height;

          // Calculate new dimensions maintaining aspect ratio
          if (logicalW > maxWidth || logicalH > maxHeight) {
            const ratio = Math.min(maxWidth / logicalW, maxHeight / logicalH);
            logicalW = Math.round(logicalW * ratio);
            logicalH = Math.round(logicalH * ratio);
          }

          // Compute the draw dimensions (pre-rotation)
          let drawW = swapped ? logicalH : logicalW;
          let drawH = swapped ? logicalW : logicalH;

          // If image is already small enough, orientation is normal, and file is under 500KB, skip
          if (orientation === 1 && drawW === img.width && drawH === img.height && file.size < 500 * 1024) {
            resolve({ file, width: logicalW, height: logicalH });
            return;
          }

          // Use regular canvas (more reliable across browsers than OffscreenCanvas
          // for image encoding, especially on mobile Safari and Android WebViews)
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            console.warn('[optimizeImage] Canvas 2D context unavailable, using original');
            resolve(fallback);
            return;
          }

          // Apply EXIF orientation transform — sets canvas dimensions and ctx transform
          if (orientation > 1) {
            applyExifOrientation(ctx, orientation, drawW, drawH);
          } else {
            canvas.width = drawW;
            canvas.height = drawH;
          }

          // Enable high-quality downscaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, drawW, drawH);

          // Determine output format — use JPEG as safe default.
          // Only use WebP if we've verified the browser can actually encode it.
          const useWebP = !format && detectWebPEncode();
          const outputFormat = format || (useWebP ? 'image/webp' : 'image/jpeg');
          const outputQuality = quality;

          canvas.toBlob(
            (blob) => {
              try {
                if (!blob || blob.size === 0) {
                  console.warn('[optimizeImage] toBlob returned empty, using original');
                  resolve(fallback);
                  return;
                }

                const ext = outputFormat === 'image/webp' ? 'webp' : 'jpg';
                // Sanitize filename: strip problematic chars, ensure extension
                const baseName = (file.name || 'proof').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
                const newName = `${baseName}.${ext}`;
                const optimized = new File([blob], newName, { type: outputFormat });

                // Only use optimized if it's actually smaller
                // (but always prefer the re-encoded version when orientation was corrected)
                if (optimized.size > 0 && (optimized.size < file.size || orientation > 1)) {
                  resolve({ file: optimized, width: logicalW, height: logicalH });
                } else {
                  resolve({ file, width: logicalW, height: logicalH });
                }
              } catch (e) {
                console.warn('[optimizeImage] Error creating optimized File:', e);
                resolve(fallback);
              }
            },
            outputFormat,
            outputQuality
          );
        } catch (e) {
          console.warn('[optimizeImage] Error in canvas processing:', e);
          resolve(fallback);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(url);
        console.warn('[optimizeImage] Image decode failed, using original file');
        resolve(fallback);
      };

      img.src = url;
    });
  } catch (e) {
    // Absolute last resort — if anything at all throws, return original
    console.warn('[optimizeImage] Unexpected error, using original file:', e);
    return fallback;
  }
}

/**
 * Generate a tiny blur placeholder (data URI) from an image file.
 * Creates a ~20px wide thumbnail encoded as base64 for instant display.
 *
 * @param {File|string} source - File object or image URL
 * @returns {Promise<string>} - base64 data URI for the blur placeholder
 */
export async function generateBlurPlaceholder(source) {
  const THUMB_WIDTH = 20;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const ratio = img.height / img.width;
      const thumbHeight = Math.round(THUMB_WIDTH * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = THUMB_WIDTH;
      canvas.height = thumbHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, THUMB_WIDTH, thumbHeight);

      try {
        resolve(canvas.toDataURL('image/jpeg', 0.4));
      } catch {
        resolve('');
      }

      if (typeof source !== 'string') {
        URL.revokeObjectURL(img.src);
      }
    };

    img.onerror = () => {
      resolve('');
      if (typeof source !== 'string') {
        URL.revokeObjectURL(img.src);
      }
    };

    img.src = typeof source === 'string' ? source : URL.createObjectURL(source);
  });
}

/**
 * Supabase Storage image URL with transform params.
 * Uses Supabase's built-in image transformation (if enabled) for on-the-fly resizing.
 * Falls back to original URL if transforms aren't supported.
 *
 * @param {string} url - Original Supabase Storage public URL
 * @param {Object} options
 * @param {number} options.width - Desired width
 * @param {number} options.height - Desired height
 * @param {string} options.resize - 'cover' | 'contain' | 'fill' (default 'cover')
 * @param {number} options.quality - 1-100 (default 75)
 * @returns {string} - Transformed URL
 */
export function getTransformedUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return url;

  // Supabase Image Transformations require a paid add-on.
  // The /render/image/ endpoint returns 403 when transforms aren't enabled,
  // which causes every product image to fail and show the Retry fallback.
  // Return the original URL as-is until transforms are enabled on the project.
  return url;
}

/**
 * Build srcSet string for responsive images.
 * Generates multiple sizes for the browser to pick from based on viewport.
 *
 * @param {string} url - Original image URL
 * @param {number[]} widths - Array of widths to generate (default [320, 640, 960, 1200])
 * @returns {string} - srcSet attribute value
 */
export function buildSrcSet(url, widths = [320, 640, 960, 1200]) {
  // Disabled: Supabase Image Transformations not enabled on this project (403).
  // Without transforms, srcSet would just repeat the same original URL at every width,
  // which provides no benefit. Return empty to let the browser use the src directly.
  return '';
}

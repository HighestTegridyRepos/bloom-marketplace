import { useState, useRef } from 'react';
import { supabase } from '../../shared/supabase';
import { colors, shadows } from '../../shared/theme';
import { optimizeImage, convertHeicToJpeg } from '../../shared/imageUtils';
import { Spinner } from './ui/Spinner';

export const ImageUpload = ({ images, onImagesChange, maxImages = 5, sellerId }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [imgErrors, setImgErrors] = useState(new Set());
  const fileInputRef = useRef(null);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadError('');
    setUploading(true);
    const newImages = [...images];
    const totalFiles = Math.min(files.length, maxImages - newImages.length);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (newImages.length >= maxImages) break;

      // Validate it's an accepted image format
      const acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      const acceptedExts = /\.(jpg|jpeg|png|webp|heic|heif)$/i;
      const typeOk = file.type && acceptedTypes.includes(file.type.toLowerCase());
      const extOk = acceptedExts.test(file.name || '');
      if (!typeOk && !extOk) {
        setUploadError('Please select a JPG, PNG, WebP, or HEIC image.');
        setUploading(false);
        return;
      }

      // Validate original file size (generous limit since we'll optimize)
      if (file.size > 8 * 1024 * 1024) {
        setUploadError('File too large (max 8MB)');
        setUploading(false);
        return;
      }

      try {
        // Convert HEIC/HEIF to JPEG first (iPhones default to HEIC)
        setUploadProgress(`Converting ${i + 1}/${totalFiles}...`);
        const convertedFile = await convertHeicToJpeg(file);

        // Client-side optimization: resize to max 1200px and compress
        setUploadProgress(`Optimizing ${i + 1}/${totalFiles}...`);
        const { file: optimizedFile } = await optimizeImage(convertedFile, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.82,
        });

        // Upload optimized file to Supabase Storage
        setUploadProgress(`Uploading ${i + 1}/${totalFiles}...`);
        const fileExt = optimizedFile.name.split('.').pop() || 'webp';
        const fileName = `${sellerId || 'unknown'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
        const filePath = `listings/${fileName}`;

        const { error: storageError } = await supabase.storage
          .from('images')
          .upload(filePath, optimizedFile, {
            cacheControl: '31536000', // 1 year cache — images are immutable (unique names)
            contentType: optimizedFile.type,
          });

        if (storageError) {
          setUploadError(`Upload error: ${storageError.message}`);
          setUploading(false);
          setUploadProgress('');
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(filePath);

        // Add cache-busting param to ensure fresh image loads
        newImages.push(publicUrl + '?t=' + Date.now());
      } catch (err) {
        setUploadError(`Upload failed: ${err.message}`);
        setUploading(false);
        setUploadProgress('');
        return;
      }
    }

    onImagesChange(newImages);
    setUploading(false);
    setUploadProgress('');

    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    // Clear error state for removed image and shift indices
    const newErrors = new Set();
    imgErrors.forEach(errIdx => {
      if (errIdx < index) newErrors.add(errIdx);
      else if (errIdx > index) newErrors.add(errIdx - 1);
    });
    setImgErrors(newErrors);
    onImagesChange(newImages);
  };

  const handleImageError = (index) => {
    setImgErrors(prev => new Set(prev).add(index));
  };

  // Drag-and-drop reordering (swap first image)
  const handleMakePrimary = (index) => {
    if (index === 0) return;
    const newImages = [...images];
    const [moved] = newImages.splice(index, 1);
    newImages.unshift(moved);
    // Reset error tracking on reorder
    setImgErrors(new Set());
    onImagesChange(newImages);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: 'block',
        marginBottom: 12,
        fontSize: 14,
        fontWeight: 600,
        color: colors.dark,
      }}>
        Product Images <span style={{ color: colors.gray, fontWeight: 400 }}>({images.length}/{maxImages})</span>
      </label>

      {uploadError && (
        <div style={{
          padding: '12px 16px',
          background: colors.errorBg,
          borderRadius: 10,
          color: colors.error,
          fontSize: 13,
          marginBottom: 12,
        }}>
          {uploadError}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12, marginBottom: 16 }}>
        {images.map((url, index) => (
          <div
            key={`${url}-${index}`}
            style={{
              position: 'relative',
              width: '100%',
              paddingBottom: '100%',
              borderRadius: 12,
              overflow: 'hidden',
              background: colors.blush,
              boxShadow: shadows.sm,
              border: index === 0 ? `2px solid ${colors.primary}` : 'none',
            }}
          >
            {!imgErrors.has(index) ? (
              <img
                src={url}
                alt={`Product ${index + 1}`}
                loading="lazy"
                decoding="async"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
                onError={() => handleImageError(index)}
              />
            ) : (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
                flexDirection: 'column',
                gap: 4,
              }}>
                <span>🌿</span>
                <span style={{ fontSize: 10, color: colors.error }}>Failed</span>
              </div>
            )}

            {/* Primary badge */}
            {index === 0 && (
              <div style={{
                position: 'absolute',
                bottom: 4,
                left: 4,
                padding: '2px 6px',
                borderRadius: 6,
                background: colors.primary,
                color: colors.white,
                fontSize: 9,
                fontWeight: 700,
              }}>
                Cover
              </div>
            )}

            {/* Make primary button for non-primary images */}
            {index > 0 && (
              <button
                onClick={() => handleMakePrimary(index)}
                title="Make cover image"
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 4,
                  padding: '2px 6px',
                  borderRadius: 6,
                  background: 'rgba(0,0,0,0.5)',
                  color: colors.white,
                  fontSize: 9,
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Set Cover
              </button>
            )}

            {/* Delete button */}
            <button
              onClick={() => removeImage(index)}
              aria-label={`Remove image ${index + 1}`}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: colors.error,
                color: colors.white,
                border: 'none',
                cursor: 'pointer',
                fontSize: 18,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#c0392b';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = colors.error;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>
          </div>
        ))}

        {images.length < maxImages && (
          <label style={{
            width: '100%',
            paddingBottom: '100%',
            borderRadius: 12,
            border: `2px dashed ${colors.blush}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: uploading ? 'wait' : 'pointer',
            transition: 'all 0.3s ease',
            background: colors.cream,
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseOver={(e) => {
            if (!uploading) {
              e.currentTarget.style.borderColor = colors.primary;
              e.currentTarget.style.background = colors.blush;
            }
          }}
          onMouseOut={(e) => {
            if (!uploading) {
              e.currentTarget.style.borderColor = colors.blush;
              e.currentTarget.style.background = colors.cream;
            }
          }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              style={{ display: 'none' }}
              disabled={uploading}
            />
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {uploading ? (
                <div style={{ textAlign: 'center' }}>
                  <Spinner size={24} />
                  {uploadProgress && (
                    <span style={{ display: 'block', fontSize: 10, color: colors.gray, marginTop: 4 }}>
                      {uploadProgress}
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 28, color: colors.primary, display: 'block', marginBottom: 4 }}>+</span>
                  <span style={{ fontSize: 12, color: colors.gray }}>Add Photo</span>
                  <span style={{ fontSize: 10, color: colors.lightGray, display: 'block', marginTop: 2 }}>Auto-optimized</span>
                </div>
              )}
            </div>
          </label>
        )}
      </div>

      <p style={{ fontSize: 11, color: colors.lightGray, margin: 0 }}>
        Images are automatically resized and compressed before upload. First image is the cover photo.
      </p>
    </div>
  );
};

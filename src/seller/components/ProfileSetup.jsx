import { useState } from 'react';
import { supabase } from '../../shared/supabase';
import { colors } from '../../shared/theme';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { useLanguage } from '../hooks/useLanguage';
import { sanitize } from '../lib/utils';
import { optimizeImage, convertHeicToJpeg } from '../../shared/imageUtils';
import { FARM_SIZES, GROWING_METHODS, CERTIFICATIONS } from '../lib/priceUnits';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { ChipSelect } from './ui/ChipSelect';

export const ProfileSetupScreen = ({ user, onComplete, existingProfile }) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Form state
  const [displayName, setDisplayName] = useState(existingProfile?.display_name || '');
  const [farmName, setFarmName] = useState(existingProfile?.farm_name || '');
  const [location, setLocation] = useState(existingProfile?.location || '');
  const [bio, setBio] = useState(existingProfile?.bio || '');
  const [phone, setPhone] = useState(existingProfile?.phone || '');
  const [farmSize, setFarmSize] = useState(existingProfile?.farm_size || '');
  const [yearsExperience, setYearsExperience] = useState(existingProfile?.years_experience || '');
  const [growingMethods, setGrowingMethods] = useState(existingProfile?.growing_methods || []);
  const [certifications, setCertifications] = useState(existingProfile?.certifications || []);
  const [websiteUrl, setWebsiteUrl] = useState(existingProfile?.website_url || '');
  const [instagramHandle, setInstagramHandle] = useState(existingProfile?.instagram_handle || '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(existingProfile?.profile_photo_url || '');
  const [notificationEmail, setNotificationEmail] = useState(existingProfile?.notification_email || '');
  const [lineNotifyToken, setLineNotifyToken] = useState(existingProfile?.line_notify_token || '');
  const [promptpayId, setPromptpayId] = useState(existingProfile?.promptpay_id || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [photoStatus, setPhotoStatus] = useState('');

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate it's an accepted image format
    const acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const typeOk = file.type && acceptedTypes.includes(file.type.toLowerCase());
    const extOk = /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name || '');
    if (!typeOk && !extOk) {
      setError('Please select a JPG, PNG, WebP, or HEIC image.');
      return;
    }

    // Validate file size (generous limit — we optimize client-side)
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large (max 5MB)');
      return;
    }

    setError('');
    setUploadingPhoto(true);

    try {
      // Convert HEIC/HEIF to JPEG first (iPhones default to HEIC)
      setPhotoStatus('Converting...');
      const convertedFile = await convertHeicToJpeg(file);

      // Client-side optimization: resize profile photos to 400x400 max
      setPhotoStatus('Optimizing...');
      const { file: optimizedFile } = await optimizeImage(convertedFile, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85,
      });

      setPhotoStatus('Uploading...');
      const fileExt = optimizedFile.name.split('.').pop() || 'webp';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: storageError } = await supabase.storage
        .from('images')
        .upload(filePath, optimizedFile, {
          cacheControl: '31536000',
          contentType: optimizedFile.type,
        });

      if (storageError) {
        setError(`Upload error: ${storageError.message}`);
        setUploadingPhoto(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      setProfilePhotoUrl(publicUrl + '?t=' + Date.now());
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    }
    setUploadingPhoto(false);
    setPhotoStatus('');
  };

  const handleSubmit = async () => {
    if (loading) return; // Prevent double submission
    setError('');

    // Validate display name length
    if (displayName.trim().length > 0 && displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters long');
      return;
    }

    // Validate farm name length if provided
    if (farmName.trim().length > 0 && farmName.trim().length < 2) {
      setError('Farm/Business name must be at least 2 characters long');
      return;
    }

    // Validate bio max length
    if (bio.trim().length > 500) {
      setError('Bio must be 500 characters or less');
      return;
    }

    // Validate phone number if provided
    if (phone.trim()) {
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 9) {
        setError('Phone number must be at least 9 digits');
        return;
      }
    }

    // Validate website URL if provided
    if (websiteUrl.trim()) {
      if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
        setError('Website URL must start with http:// or https://');
        return;
      }
    }

    setLoading(true);

    // Use email username as fallback if no display name provided
    const finalDisplayName = displayName.trim() || user.email.split('@')[0];

    const profileData = {
      user_id: user.id,
      display_name: sanitize(finalDisplayName),
      email: user.email,
      phone: sanitize(phone) || null,
      location: sanitize(location) || null,
      bio: sanitize(bio) || null,
      profile_photo_url: profilePhotoUrl || null,
      farm_name: sanitize(farmName) || null,
      farm_size: farmSize || null,
      years_experience: yearsExperience ? parseInt(yearsExperience) : null,
      growing_methods: growingMethods.length > 0 ? growingMethods : null,
      certifications: certifications.length > 0 ? certifications : null,
      website_url: sanitize(websiteUrl) || null,
      instagram_handle: sanitize(instagramHandle) || null,
      notification_email: sanitize(notificationEmail) || null,
      line_notify_token: sanitize(lineNotifyToken) || null,
      promptpay_id: sanitize(promptpayId) || null,
    };

    try {
      if (existingProfile) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', existingProfile.id);
        if (error) throw error;
      } else {
        // Insert new profile
        const { error } = await supabase
          .from('profiles')
          .insert([profileData]);
        if (error) throw error;
      }
      onComplete();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const renderStep1 = () => (
    <>
      <h2 style={{ fontSize: isMobile ? 18 : 24, fontWeight: 700, marginBottom: 8, color: colors.dark }}>
        {t('step_basics')}
      </h2>
      <p style={{ color: colors.gray, marginBottom: 28 }}>
        {t('step_basics_sub')}
      </p>

      {/* Profile Photo */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: colors.gradient1,
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {profilePhotoUrl ? (
            <img src={profilePhotoUrl} alt="Profile" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 48 }}>🌿</span>
          )}
        </div>
        <label style={{
          display: 'inline-block',
          padding: '8px 20px',
          background: colors.white,
          border: `2px solid ${colors.primary}`,
          borderRadius: 20,
          color: colors.primary,
          fontWeight: 600,
          fontSize: 14,
          cursor: uploadingPhoto ? 'wait' : 'pointer',
        }}>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            style={{ display: 'none' }}
            disabled={uploadingPhoto}
          />
          {uploadingPhoto ? (photoStatus || 'Uploading...') : '📷 Upload Photo'}
        </label>
      </div>

      <Input
        label={t('display_name')}
        value={displayName}
        onChange={setDisplayName}
        placeholder="John Smith (optional)"
        icon="👤"
      />
      <Input
        label={t('farm_name')}
        value={farmName}
        onChange={setFarmName}
        placeholder="Sunny Meadows Farm"
        icon="🏡"
      />
      <Input
        label={t('location')}
        value={location}
        onChange={setLocation}
        placeholder="Portland, Oregon"
        icon="📍"
      />
    </>
  );

  const renderStep2 = () => (
    <>
      <h2 style={{ fontSize: isMobile ? 18 : 24, fontWeight: 700, marginBottom: 8, color: colors.dark }}>
        {t('step_operation')}
      </h2>
      <p style={{ color: colors.gray, marginBottom: 28 }}>
        {t('step_operation_sub')}
      </p>

      <Select
        label="Operation Size"
        value={farmSize}
        onChange={setFarmSize}
        options={FARM_SIZES}
        placeholder="Select your operation size"
      />

      <Input
        label="Years of Experience"
        type="number"
        value={yearsExperience}
        onChange={setYearsExperience}
        placeholder="5"
        icon="📅"
      />

      <ChipSelect
        label="Growing Methods"
        options={GROWING_METHODS}
        selected={growingMethods}
        onChange={setGrowingMethods}
      />

      <ChipSelect
        label="Certifications"
        options={CERTIFICATIONS}
        selected={certifications}
        onChange={setCertifications}
      />
    </>
  );

  const renderStep3 = () => (
    <>
      <h2 style={{ fontSize: isMobile ? 18 : 24, fontWeight: 700, marginBottom: 8, color: colors.dark }}>
        {t('step_final')}
      </h2>
      <p style={{ color: colors.gray, marginBottom: 28 }}>
        {t('step_final_sub')}
      </p>

      <div style={{ marginBottom: 20 }}>
        <label style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
          fontSize: 14,
          fontWeight: 600,
          color: colors.dark,
        }}>
          <span>Bio 📝</span>
          <span style={{ color: colors.gray, fontWeight: 400 }}>{bio.length}/500</span>
        </label>
        <Input
          multiline
          rows={4}
          value={bio}
          onChange={setBio}
          placeholder="Tell buyers about your story, what makes your supplies special..."
        />
      </div>

      <Input
        label={t('phone')}
        type="tel"
        value={phone}
        onChange={setPhone}
        placeholder="(555) 123-4567"
        icon="📱"
      />

      <Input
        label={t('website')}
        type="url"
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://yourfarm.com"
        icon="🌐"
      />

      <Input
        label="Instagram Handle"
        value={instagramHandle}
        onChange={setInstagramHandle}
        placeholder="@yourfarm"
        icon="📸"
      />

      {/* Order Notification Settings */}
      <div style={{
        marginTop: 28,
        paddingTop: 24,
        borderTop: `1px solid ${colors.blush}`,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.dark, marginBottom: 4 }}>
          {t('order_notifications')}
        </h3>
        <p style={{ fontSize: 13, color: colors.gray, marginBottom: 16 }}>
          Get notified when a customer places an order
        </p>

        <Input
          label={t('notification_email')}
          type="email"
          value={notificationEmail}
          onChange={setNotificationEmail}
          placeholder="orders@yourfarm.com (uses account email if blank)"
          icon="📧"
        />

        <Input
          label={t('line_id')}
          value={lineNotifyToken}
          onChange={setLineNotifyToken}
          placeholder="Your LINE Notify access token (optional)"
          icon="💬"
        />
        <p style={{ fontSize: 12, color: colors.gray, marginTop: -12, marginBottom: 16 }}>
          Get a token at <a href="https://notify-bot.line.me/" target="_blank" rel="noopener noreferrer" style={{ color: colors.primary }}>notify-bot.line.me</a>
        </p>
      </div>

      {/* PromptPay Payment Settings */}
      <div style={{
        marginTop: 20,
        paddingTop: 24,
        borderTop: `1px solid ${colors.blush}`,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.dark, marginBottom: 4 }}>
          {t('promptpay_section')}
        </h3>
        <p style={{ fontSize: 13, color: colors.gray, marginBottom: 16 }}>
          Let customers pay you instantly via QR code
        </p>

        <Input
          label={t('promptpay_id')}
          value={promptpayId}
          onChange={setPromptpayId}
          placeholder="Phone number (08X-XXX-XXXX) or citizen ID"
          icon="📱"
        />
        <p style={{ fontSize: 12, color: colors.gray, marginTop: -12, marginBottom: 16 }}>
          Customers will see a QR code at checkout to pay you directly
        </p>
      </div>
    </>
  );

  return (
    <div className="page-transition" style={{
      minHeight: '100vh',
      padding: 20,
      background: `linear-gradient(180deg, ${colors.cream} 0%, ${colors.peach} 100%)`,
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Progress */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: colors.gray }}>Step {step} of {totalSteps}</span>
            <span style={{ fontSize: 14, color: colors.primary, fontWeight: 600 }}>
              {Math.round((step / totalSteps) * 100)}%
            </span>
          </div>
          <div style={{
            height: 8,
            background: colors.blush,
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${(step / totalSteps) * 100}%`,
              background: colors.gradient1,
              borderRadius: 4,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>

        <Card style={{ padding: 32 }} className="animate-slide-up">
          {error && (
            <div
              className="animate-shake"
              style={{
                padding: '12px 16px',
                background: colors.errorBg,
                borderRadius: 10,
                color: colors.error,
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              {error}
            </div>
          )}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}

          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            {step > 1 && (
              <Button
                variant="secondary"
                onClick={() => setStep(step - 1)}
                style={{ flex: 1 }}
              >
                {t('btn_back')}
              </Button>
            )}
            {step < totalSteps ? (
              <Button
                onClick={() => setStep(step + 1)}
                style={{ flex: 1 }}
              >
                {t('btn_continue')}
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                loading={loading}
                style={{ flex: 1 }}
              >
                {t('btn_complete')}
              </Button>
            )}
          </div>

          {/* Skip option */}
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                background: 'transparent',
                border: 'none',
                color: colors.gray,
                fontSize: 14,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}
            >
              {t('btn_skip')}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};


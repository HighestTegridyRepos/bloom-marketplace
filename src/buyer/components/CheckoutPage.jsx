import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import QRCode from 'qrcode';
import { colors } from '../../shared/theme';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { supabase } from '../../shared/supabase';
import { optimizeImage, convertHeicToJpeg } from '../../shared/imageUtils';
import { QRCODE_DATA_URI } from '../../shared/qrcode';
import { getProvinceNames, getDistrictNames } from '../lib/thailandLocations';

// =============================================
// Autocomplete input component for provinces and districts
// =============================================
const AutocompleteInput = ({ value, onChange, suggestions, placeholder, inputStyle, colors, fieldError, errorId, onFocus: parentOnFocus, onBlur: parentOnBlur }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    if (!value || value.length === 0) return suggestions;
    const lower = value.toLowerCase();
    // Exact match → hide dropdown
    if (suggestions.some(s => s.toLowerCase() === lower)) return [];
    return suggestions.filter(s => s.toLowerCase().includes(lower));
  }, [value, suggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const handleKeyDown = (e) => {
    if (!showDropdown || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      onChange(filtered[highlightIndex]);
      setShowDropdown(false);
      setHighlightIndex(-1);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setShowDropdown(true); setHighlightIndex(-1); }}
        onFocus={e => { setShowDropdown(true); if (parentOnFocus) parentOnFocus(e); }}
        onBlur={e => { if (parentOnBlur) parentOnBlur(e); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        style={{ ...inputStyle, borderColor: fieldError ? colors.error : inputStyle.borderColor }}
        aria-invalid={!!fieldError}
        aria-describedby={fieldError ? errorId : undefined}
        aria-autocomplete="list"
        role="combobox"
        aria-expanded={showDropdown && filtered.length > 0}
      />
      {showDropdown && filtered.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            maxHeight: 220, overflowY: 'auto', background: '#fff',
            border: `2px solid ${colors.primary}`, borderTop: 'none',
            borderRadius: '0 0 12px 12px', margin: 0, padding: 0,
            listStyle: 'none', zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          {filtered.slice(0, 50).map((item, i) => (
            <li
              key={item}
              role="option"
              aria-selected={i === highlightIndex}
              onMouseDown={(e) => { e.preventDefault(); onChange(item); setShowDropdown(false); }}
              onMouseEnter={() => setHighlightIndex(i)}
              style={{
                padding: '10px 16px', cursor: 'pointer', fontSize: 15,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                background: i === highlightIndex ? colors.mint : '#fff',
                color: colors.dark,
                borderBottom: i < filtered.length - 1 ? `1px solid ${colors.cream}` : 'none',
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// =============================================
// CHECKOUT PAGE — Multi-step: Info → QR Payment → Screenshot Upload → Auto-submit
// =============================================
export const CheckoutPage = ({ cart, onPlaceOrder, onBack, t = (key) => key, lang = 'en' }) => {
  const isMobile = useIsMobile();
  // Step: 1 = delivery info, 2 = QR payment + screenshot upload
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [proofStatus, setProofStatus] = useState(''); // '', 'converting', 'optimizing', 'uploading'
  const [proofPreview, setProofPreview] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('promptpay');
  const [fieldErrors, setFieldErrors] = useState({});

  // Crypto wallet addresses
  const CRYPTO_WALLETS = {
    btc: { label: 'Bitcoin (BTC)', symbol: 'BTC', address: 'bc1qmtwnd93qgtf3tganunljff9s442yjrwfuv0v0c', color: '#F7931A', icon: '₿', networkNote: 'Bitcoin mainnet only' },
    eth: { label: 'Ethereum (ETH)', symbol: 'ETH', address: '0xe99a9dfFF458d0c4D00DB0C0076e3C5949c821e7', color: '#627EEA', icon: 'Ξ', networkNote: 'ERC-20 (Ethereum mainnet)' },
    sol: { label: 'Solana (SOL)', symbol: 'SOL', address: 'gNW9878ih9AL2j5r2F8u6mGKiAQX7vuGqWWawvP9Lu2', color: '#9945FF', icon: '◎', networkNote: 'Solana mainnet only' },
  };

  const PAYMENT_METHODS = [
    { id: 'promptpay', label: lang === 'th' ? 'พร้อมเพย์' : 'PromptPay', icon: '🏦', desc: lang === 'th' ? 'สแกน QR จ่ายผ่านแอปธนาคาร' : 'Scan QR via Thai banking app' },
    { id: 'btc', label: 'Bitcoin', icon: '₿', desc: 'BTC', color: '#F7931A' },
    { id: 'eth', label: 'Ethereum', icon: 'Ξ', desc: 'ETH', color: '#627EEA' },
    { id: 'sol', label: 'Solana', icon: '◎', desc: 'SOL', color: '#9945FF' },
  ];

  const isCrypto = ['btc', 'eth', 'sol'].includes(paymentMethod);
  const selectedCrypto = isCrypto ? CRYPTO_WALLETS[paymentMethod] : null;

  // Generate QR code as data URI client-side (no external API, no CSP issues)
  const [cryptoQrUrl, setCryptoQrUrl] = useState(null);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    setCryptoQrUrl(null);
    setQrLoaded(false);
    setQrError(false);
    if (!isCrypto || !selectedCrypto) return;
    QRCode.toDataURL(selectedCrypto.address, {
      width: 250,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(url => { setCryptoQrUrl(url); setQrLoaded(true); })
      .catch(() => setQrError(true));
  }, [paymentMethod]);

  // Track copy state for UX feedback
  const [copied, setCopied] = useState(false);
  const handleCopyAddress = useCallback(() => {
    if (!selectedCrypto) return;
    navigator.clipboard?.writeText(selectedCrypto.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [selectedCrypto]);
  const fileInputRef = useRef(null);

  const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  // Real-time field validation
  const validateField = (field, value) => {
    const errs = { ...fieldErrors };
    switch (field) {
      case 'name':
        errs.name = value.length > 0 && value.length < 2 ? (lang === 'th' ? 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร' : 'Name must be at least 2 characters') : '';
        break;
      case 'phone':
        const digits = value.replace(/\D/g, '');
        if (digits.length > 0) {
          if (digits.length < 9 || digits.length > 10) {
            errs.phone = lang === 'th' ? 'เบอร์โทรต้องมี 9-10 หลัก (เริ่มต้นด้วย 0)' : 'Thai phone must be 9-10 digits (starting with 0)';
          } else if (!digits.startsWith('0')) {
            errs.phone = lang === 'th' ? 'เบอร์โทรต้องเริ่มต้นด้วย 0' : 'Thai phone must start with 0';
          } else {
            errs.phone = '';
          }
        } else {
          errs.phone = '';
        }
        break;
      case 'postalCode':
        const postal = value.replace(/\D/g, '');
        errs.postalCode = postal.length > 0 && postal.length !== 5 ? (lang === 'th' ? 'รหัสไปรษณีย์ต้องมี 5 หลัก' : 'Postal code must be 5 digits') : '';
        break;
    }
    setFieldErrors(errs);
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: 12,
    border: `2px solid ${colors.blush}`, fontSize: 16,
    fontFamily: 'Plus Jakarta Sans, sans-serif', outline: 'none',
    transition: 'border-color 0.3s', minHeight: 44,
  };

  // Step 1 → Step 2 validation
  const handleContinueToPayment = (e) => {
    e.preventDefault();
    setError('');

    if (!name || !phone || !address || !district || !province || !postalCode) {
      setError(t('validation_required'));
      return;
    }
    if (name.length < 2) {
      setError(t('validation_name_length'));
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 10) {
      setError(lang === 'th' ? 'เบอร์โทรต้องมี 9-10 หลัก (เริ่มต้นด้วย 0)' : 'Thai phone must be 9-10 digits (starting with 0)');
      return;
    }
    if (!phoneDigits.startsWith('0')) {
      setError(lang === 'th' ? 'เบอร์โทรต้องเริ่มต้นด้วย 0' : 'Thai phone must start with 0');
      return;
    }
    const postalDigits = postalCode.replace(/\D/g, '');
    if (postalDigits.length !== 5) {
      setError(t('validation_postal_code'));
      return;
    }

    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle proof screenshot file selection
  const MAX_PROOF_SIZE = 10 * 1024 * 1024; // 10MB max (PromptPay screenshots are rarely >3MB)
  const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

  const isImageFile = (file) => {
    // Check MIME type against allowlist
    if (file.type && ACCEPTED_IMAGE_TYPES.includes(file.type.toLowerCase())) return true;
    // Some banking apps don't set MIME type — check extension as fallback
    const ext = '.' + (file.name || '').split('.').pop()?.toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext);
  };

  const handleProofSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isImageFile(file)) {
      setError(lang === 'th' ? 'กรุณาอัพโหลดไฟล์รูปภาพ (ภาพหน้าจอการชำระเงิน)' : 'Please upload an image file (screenshot of your payment)');
      return;
    }
    if (file.size > MAX_PROOF_SIZE) {
      setError(lang === 'th' ? 'ไฟล์ใหญ่เกินไป (สูงสุด 10MB)' : 'File too large. Maximum size is 10MB.');
      return;
    }
    setError('');
    setProofFile(file);
    // Generate preview — wrap in try/catch because FileReader can fail on some mobile browsers
    try {
      const reader = new FileReader();
      reader.onload = (ev) => setProofPreview(ev.target.result);
      reader.onerror = () => {
        // Preview failed but file is still valid for upload — show generic thumbnail
        setProofPreview('data:image/svg+xml,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#e8f5e9" width="200" height="200"/><text x="100" y="90" text-anchor="middle" font-size="48">📷</text><text x="100" y="130" text-anchor="middle" font-size="14" fill="#2D7D46">Image selected</text></svg>'
        ));
      };
      reader.readAsDataURL(file);
    } catch {
      // FileReader not available or crashed — still allow upload
      setProofPreview('data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#e8f5e9" width="200" height="200"/><text x="100" y="90" text-anchor="middle" font-size="48">📷</text><text x="100" y="130" text-anchor="middle" font-size="14" fill="#2D7D46">Image selected</text></svg>'
      ));
    }
  };

  // Handle drag and drop for payment proof
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!isImageFile(file)) {
        setError(lang === 'th' ? 'กรุณาอัพโหลดไฟล์รูปภาพ (ภาพหน้าจอการชำระเงิน)' : 'Please upload an image file (screenshot of your payment)');
        return;
      }
      if (file.size > MAX_PROOF_SIZE) {
        setError(lang === 'th' ? 'ไฟล์ใหญ่เกินไป (สูงสุด 10MB)' : 'File too large. Maximum size is 10MB.');
        return;
      }
      setError('');
      setProofFile(file);
      try {
        const reader = new FileReader();
        reader.onload = (ev) => setProofPreview(ev.target.result);
        reader.onerror = () => {
          setProofPreview('data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#e8f5e9" width="200" height="200"/><text x="100" y="90" text-anchor="middle" font-size="48">📷</text><text x="100" y="130" text-anchor="middle" font-size="14" fill="#2D7D46">Image selected</text></svg>'
          ));
        };
        reader.readAsDataURL(file);
      } catch {
        setProofPreview('data:image/svg+xml,' + encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect fill="#e8f5e9" width="200" height="200"/><text x="100" y="90" text-anchor="middle" font-size="48">📷</text><text x="100" y="130" text-anchor="middle" font-size="14" fill="#2D7D46">Image selected</text></svg>'
        ));
      }
    }
  };

  // ---- Upload helpers with retry ----

  /**
   * Upload a file to Supabase Storage with retry logic.
   * Critical path — customers have already paid when this runs.
   * Retries up to 3 times with exponential backoff.
   */
  const uploadWithRetry = async (filePath, fileToUpload, retries = 3) => {
    let lastError = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const contentType = fileToUpload.type || 'image/jpeg';
        const { data, error } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, fileToUpload, {
            cacheControl: '3600',
            upsert: false,
            contentType,
          });
        if (!error) return { data, error: null };
        lastError = error;
        console.warn(`[Upload] Attempt ${attempt}/${retries} failed:`, error.message || error);
      } catch (e) {
        lastError = e;
        console.warn(`[Upload] Attempt ${attempt}/${retries} exception:`, e.message || e);
      }
      // Exponential backoff: 1s, 2s, 4s
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
      }
    }
    return { data: null, error: lastError };
  };

  /**
   * Prepare a file for upload — optimize if possible, ensure valid MIME type.
   * Returns a File that's guaranteed safe to upload.
   */
  const prepareFileForUpload = async (rawFile) => {
    // 1. Convert HEIC/HEIF to JPEG first (iPhones default to HEIC)
    //    This ensures the file is web-displayable and email-safe.
    let file = rawFile;
    try {
      setProofStatus(lang === 'th' ? 'กำลังแปลงไฟล์...' : 'Converting...');
      file = await convertHeicToJpeg(rawFile);
    } catch (e) {
      console.warn('[prepareFile] HEIC conversion failed, continuing with original:', e);
    }

    // 2. Try to optimize the image (resize/compress)
    try {
      setProofStatus(lang === 'th' ? 'กำลังปรับขนาด...' : 'Optimizing...');
      const { file: optimized } = await optimizeImage(file, {
        maxWidth: 1200,
        maxHeight: 1600,
        quality: 0.85,
      });
      // Verify the optimized file is valid
      if (optimized && optimized.size > 0) {
        return optimized;
      }
    } catch (e) {
      console.warn('[prepareFile] Optimization failed, using original:', e);
    }

    // 3. If optimization returned the same file or failed, ensure it has a valid type
    //    Some banking apps download screenshots without proper MIME types
    if (!file.type || !file.type.startsWith('image/')) {
      const ext = (file.name || '').split('.').pop()?.toLowerCase();
      const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
      const inferredType = mimeMap[ext] || 'image/jpeg';
      return new File([file], file.name || 'payment-proof.jpg', { type: inferredType });
    }

    return file;
  };

  // Submit order (PromptPay QR or Crypto)
  const handleSubmitOrder = async () => {
    // Prevent double-submit while Supabase calls are in-flight
    if (loading) return;

    if (!proofFile) {
      const msg = isCrypto
        ? (lang === 'th' ? 'กรุณาอัพโหลดภาพหน้าจอการโอนคริปโตก่อน' : 'Please upload your crypto transfer screenshot first')
        : (lang === 'th' ? 'กรุณาอัพโหลดภาพหน้าจอการชำระเงินก่อน' : 'Please upload your payment screenshot first');
      setError(msg);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sanitize = (str) => str ? str.replace(/[<>"'`\\]/g, '').trim() : '';

      let proofUrl = '';
      let emailProofUrl = '';

      // Upload payment proof (PromptPay or Crypto — both require screenshot)
      if (proofFile) {
        // Step 1: Prepare the file (HEIC convert + optimize + ensure valid MIME)
        const preparedFile = await prepareFileForUpload(proofFile);
        setProofStatus(lang === 'th' ? 'กำลังอัพโหลด...' : 'Uploading...');

        // Step 2: Generate unique file path
        const fileExt = (preparedFile.name || 'proof.jpg').split('.').pop() || 'jpg';
        const fileBase = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const fileName = `${fileBase}.${fileExt}`;
        const filePath = `proofs/${fileName}`;

        // Step 3: Upload with retry (3 attempts, exponential backoff)
        const { error: uploadError } = await uploadWithRetry(filePath, preparedFile);

        if (uploadError) {
          // If optimized file failed, try the HEIC-converted (but un-optimized) file as fallback.
          // Use convertHeicToJpeg again to ensure we never upload raw HEIC to storage.
          console.warn('[Checkout] Optimized upload failed, trying converted fallback...');
          const fallbackFile = await convertHeicToJpeg(proofFile);
          const rawExt = (fallbackFile.name || 'proof.jpg').split('.').pop() || 'jpg';
          const rawFileName = `${Date.now()}-raw-${Math.random().toString(36).substr(2, 9)}.${rawExt}`;
          const rawFilePath = `proofs/${rawFileName}`;

          const rawUpload = await uploadWithRetry(rawFilePath, fallbackFile, 2);
          if (rawUpload.error) {
            const detail = rawUpload.error?.message || rawUpload.error?.statusCode || 'Unknown error';
            console.error('[Checkout] All upload attempts failed:', detail);
            throw new Error(
              lang === 'th'
                ? `อัพโหลดภาพไม่สำเร็จ กรุณาลองใหม่ (${detail})`
                : `Failed to upload payment screenshot. Please try again. (${detail})`
            );
          }
          // Raw upload succeeded — get its URL
          const { data: rawUrlData } = supabase.storage
            .from('payment-proofs')
            .getPublicUrl(rawFilePath);
          proofUrl = rawUrlData?.publicUrl || '';
        } else {
          // Optimized upload succeeded
          const { data: urlData } = supabase.storage
            .from('payment-proofs')
            .getPublicUrl(filePath);
          proofUrl = urlData?.publicUrl || '';
        }

        // Step 4: Generate and upload email-safe version (smaller JPEG for email embedding)
        // This is non-blocking — if it fails, the order still has the full proof URL.
        try {
          const { file: emailFile } = await optimizeImage(preparedFile, {
            maxWidth: 800,
            maxHeight: 600,
            quality: 0.75,
            format: 'image/jpeg',
          });
          if (emailFile && emailFile.size > 0 && emailFile.size < preparedFile.size) {
            const emailPath = `proofs/${fileBase}-email.jpg`;
            const emailUpload = await uploadWithRetry(emailPath, emailFile, 1);
            if (!emailUpload.error) {
              const { data: emailUrlData } = supabase.storage
                .from('payment-proofs')
                .getPublicUrl(emailPath);
              emailProofUrl = emailUrlData?.publicUrl || '';
              console.log(`[Checkout] Email-safe proof uploaded: ${(emailFile.size / 1024).toFixed(0)}KB`);
            }
          }
        } catch (e) {
          console.warn('[Checkout] Email-safe version failed (non-critical):', e);
        }
      }

      // Atomic order placement — validates stock, decrements inventory, and inserts orders
      // in a single database transaction to prevent overselling
      const orderItems = cart.map(item => ({
        listing_id: item.product.id,
        quantity: item.quantity,
      }));

      const { data: rpcResult, error: rpcError } = await supabase.rpc('place_order_atomic', {
        p_items: orderItems,
        p_customer_name: sanitize(name),
        p_customer_phone: sanitize(phone),
        p_address: sanitize(address),
        p_district: sanitize(district),
        p_province: sanitize(province),
        p_postal_code: sanitize(postalCode),
        p_delivery_notes: sanitize(notes || ''),
        p_payment_method: paymentMethod,
        p_payment_proof_url: proofUrl || null,
      });

      if (rpcError) {
        // Parse user-friendly error messages from the RPC
        const msg = rpcError.message || '';
        if (msg.includes('no longer available') || msg.includes('Only ') || msg.includes('not found')) {
          throw new Error(msg);
        }
        throw new Error(
          lang === 'th'
            ? 'ไม่สามารถสั่งซื้อได้ กรุณาลองใหม่'
            : 'Failed to place order. Please try again.'
        );
      }

      // If we generated an email-safe proof, attach it to the order(s) via UPDATE.
      // Fire-and-forget — order is already placed, this is enhancement only.
      if (emailProofUrl && proofUrl) {
        supabase
          .from('orders')
          .update({ payment_proof_email_url: emailProofUrl })
          .eq('payment_proof_url', proofUrl)
          .then(({ error: updateErr }) => {
            if (updateErr) console.warn('[Checkout] Email proof URL update failed:', updateErr.message);
            else console.log('[Checkout] Email proof URL attached to order');
          });
      }

      onPlaceOrder({ name, phone, address, district, province, postalCode, notes, paymentMethod, total });
    } catch (err) {
      setError(err.message || (lang === 'th' ? 'เกิดข้อผิดพลาด กรุณาลองใหม่' : 'Something went wrong. Please try again.'));
      setLoading(false);
      setProofStatus('');
    }
  };

  // ---- Step indicators ----
  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: isMobile ? 24 : 40 }}>
      {[
        { num: 1, label: t('step_delivery') },
        { num: 2, label: t('step_pay') },
      ].map((s, i) => (
        <React.Fragment key={s.num}>
          {i > 0 && (
            <div style={{
              width: isMobile ? 40 : 60, height: 3, background: step >= s.num ? colors.primary : colors.blush,
              transition: 'background 0.3s',
            }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: step >= s.num ? colors.primary : colors.blush,
              color: step >= s.num ? '#fff' : colors.gray,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14, transition: 'all 0.3s',
            }}>
              {step > s.num ? '✓' : s.num}
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600,
              color: step >= s.num ? colors.dark : colors.gray,
            }}>{s.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );

  // ---- Order summary (shared) ----
  const OrderSummary = () => (
    <div style={{
      background: colors.cream, borderRadius: 16, padding: isMobile ? 14 : 20, marginBottom: isMobile ? 20 : 32,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.dark, marginBottom: 16 }}>{t('checkout_summary')}</h3>
      {cart.map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: colors.gray }}>{item.product.title} × {item.quantity}</span>
          <span style={{ fontWeight: 600, color: colors.dark }}>฿{(item.product.price * item.quantity).toFixed(0)}</span>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${colors.blush}`, paddingTop: 12, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, color: colors.dark }}>{t('checkout_total')}</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: colors.primary }}>฿{total.toFixed(0)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <section style={{ minHeight: '100vh', padding: isMobile ? '80px 16px 40px' : '120px 24px 80px', background: colors.cream }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <button onClick={step === 1 ? onBack : () => { setStep(1); setError(''); }} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 24px', borderRadius: 30, minHeight: 44,
          border: 'none', background: colors.white,
          color: colors.dark, fontWeight: 600, fontSize: 16,
          cursor: 'pointer', marginBottom: 32,
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}>
          ← {step === 1 ? t('back_cart') : t('back_delivery')}
        </button>

        <h2 style={{ fontSize: isMobile ? 24 : 36, fontWeight: 800, color: colors.dark, marginBottom: 8, textAlign: 'center' }}>
          {t('checkout_title')} 📦
        </h2>

        <StepIndicator />

        <div style={{
          background: colors.white, borderRadius: 24, padding: isMobile ? 20 : 40,
          boxShadow: '0 10px 40px rgba(45, 125, 70, 0.15)',
        }}>
          <OrderSummary />

          {error && (
            <div role="alert" style={{
              padding: '12px 16px', background: colors.errorBg, borderRadius: 10,
              color: colors.error, fontSize: 14, marginBottom: 20, textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          {/* ========== STEP 1: Delivery Info ========== */}
          {step === 1 && (
            <form onSubmit={handleContinueToPayment}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: colors.dark, marginBottom: 20 }}>{t('checkout_delivery')}</h3>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: colors.dark }}>
                  {t('checkout_name')} *
                </label>
                <input type="text" value={name} onChange={e => { setName(e.target.value); validateField('name', e.target.value); }}
                  aria-invalid={!!fieldErrors.name}
                  aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                  style={{ ...inputStyle, borderColor: fieldErrors.name ? colors.error : inputStyle.borderColor }}
                  onFocus={e => e.target.style.borderColor = fieldErrors.name ? colors.error : colors.primary}
                  onBlur={e => { e.target.style.borderColor = fieldErrors.name ? colors.error : colors.blush; validateField('name', name); }} />
                {fieldErrors.name && <span id="name-error" style={{ color: colors.error, fontSize: 12, marginTop: 4, display: 'block' }} role="alert">{fieldErrors.name}</span>}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: colors.dark }}>
                  {t('checkout_phone')} *
                </label>
                <input type="tel" inputMode="tel" value={phone} onChange={e => { setPhone(e.target.value); validateField('phone', e.target.value); }} placeholder={lang === 'th' ? '08X-XXX-XXXX หรือ 02-XXX-XXXX' : '08X-XXX-XXXX or 02-XXX-XXXX'}
                  aria-invalid={!!fieldErrors.phone}
                  aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                  style={{ ...inputStyle, borderColor: fieldErrors.phone ? colors.error : inputStyle.borderColor }}
                  onFocus={e => e.target.style.borderColor = fieldErrors.phone ? colors.error : colors.primary}
                  onBlur={e => { e.target.style.borderColor = fieldErrors.phone ? colors.error : colors.blush; validateField('phone', phone); }} />
                {fieldErrors.phone && <span id="phone-error" style={{ color: colors.error, fontSize: 12, marginTop: 4, display: 'block' }} role="alert">{fieldErrors.phone}</span>}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: colors.dark }}>
                  {t('checkout_address')} *
                </label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
                  placeholder="House number, street, building..." style={{ ...inputStyle, resize: 'vertical' }}
                  aria-invalid={!!fieldErrors.address}
                  aria-describedby={fieldErrors.address ? 'address-error' : undefined}
                  onFocus={e => e.target.style.borderColor = colors.primary}
                  onBlur={e => e.target.style.borderColor = colors.blush} />
                {fieldErrors.address && <span id="address-error" style={{ color: colors.error, fontSize: 12, marginTop: 4, display: 'block' }} role="alert">{fieldErrors.address}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: colors.dark }}>
                    {t('checkout_province')} *
                  </label>
                  <AutocompleteInput
                    value={province}
                    onChange={(val) => { setProvince(val); if (val !== province) setDistrict(''); }}
                    suggestions={getProvinceNames(lang)}
                    placeholder={lang === 'th' ? 'พิมพ์ชื่อจังหวัด...' : 'Type province name...'}
                    inputStyle={inputStyle}
                    colors={colors}
                    fieldError={fieldErrors.province}
                    errorId="province-error"
                  />
                  {fieldErrors.province && <span id="province-error" style={{ color: colors.error, fontSize: 12, marginTop: 4, display: 'block' }} role="alert">{fieldErrors.province}</span>}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: colors.dark }}>
                    {t('checkout_district')} *
                  </label>
                  <AutocompleteInput
                    value={district}
                    onChange={setDistrict}
                    suggestions={getDistrictNames(province, lang)}
                    placeholder={lang === 'th' ? 'พิมพ์ชื่ออำเภอ/เขต...' : 'Type district name...'}
                    inputStyle={inputStyle}
                    colors={colors}
                    fieldError={fieldErrors.district}
                    errorId="district-error"
                  />
                  {fieldErrors.district && <span id="district-error" style={{ color: colors.error, fontSize: 12, marginTop: 4, display: 'block' }} role="alert">{fieldErrors.district}</span>}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: colors.dark }}>
                  {t('checkout_postal')} *
                </label>
                <input type="text" value={postalCode} onChange={e => { setPostalCode(e.target.value); validateField('postalCode', e.target.value); }} placeholder="10XXX"
                  aria-invalid={!!fieldErrors.postalCode}
                  aria-describedby={fieldErrors.postalCode ? 'postalCode-error' : undefined}
                  style={{ ...inputStyle, borderColor: fieldErrors.postalCode ? colors.error : inputStyle.borderColor }}
                  onFocus={e => e.target.style.borderColor = fieldErrors.postalCode ? colors.error : colors.primary}
                  onBlur={e => { e.target.style.borderColor = fieldErrors.postalCode ? colors.error : colors.blush; validateField('postalCode', postalCode); }} />
                {fieldErrors.postalCode && <span id="postalCode-error" style={{ color: colors.error, fontSize: 12, marginTop: 4, display: 'block' }} role="alert">{fieldErrors.postalCode}</span>}
              </div>

              <div style={{ marginBottom: 32 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: colors.dark }}>
                  {t('checkout_notes')}
                </label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Special instructions, landmarks, etc..." style={{ ...inputStyle, resize: 'vertical' }}
                  onFocus={e => e.target.style.borderColor = colors.primary}
                  onBlur={e => e.target.style.borderColor = colors.blush} />
              </div>

              <button type="submit" style={{
                width: '100%', padding: isMobile ? '16px 24px' : '20px 40px', borderRadius: 30, minHeight: 44,
                border: 'none', background: colors.gradient1,
                color: colors.white, fontWeight: 700, fontSize: isMobile ? 16 : 18,
                cursor: 'pointer',
                boxShadow: '0 8px 30px rgba(45, 125, 70, 0.4)',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}>
                Continue to Payment →
              </button>
            </form>
          )}

          {/* ========== STEP 2: Payment Method + Submit ========== */}
          {step === 2 && (
            <div>
              {/* Payment Method Selector */}
              <h3 style={{ fontSize: 18, fontWeight: 700, color: colors.dark, marginBottom: 16 }}>
                {t('select_payment')}
              </h3>
              <div style={{
                display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                gap: 10, marginBottom: 24,
              }}>
                {PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => { setPaymentMethod(pm.id); setProofFile(null); setProofPreview(null); setError(''); }}
                    style={{
                      padding: '14px 8px', borderRadius: 14, cursor: 'pointer',
                      border: paymentMethod === pm.id ? `2px solid ${pm.color || colors.primary}` : `2px solid ${colors.blush}`,
                      background: paymentMethod === pm.id ? (pm.color ? `${pm.color}10` : colors.mint) : colors.white,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{pm.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: paymentMethod === pm.id ? (pm.color || colors.primary) : colors.dark }}>{pm.label}</span>
                    <span style={{ fontSize: 11, color: colors.gray }}>{pm.desc}</span>
                  </button>
                ))}
              </div>

              {/* ---- PromptPay QR Section ---- */}
              {paymentMethod === 'promptpay' && (
                <div style={{
                  background: 'linear-gradient(135deg, #E8F0FE 0%, #F0F7FF 100%)',
                  borderRadius: 20, padding: isMobile ? 20 : 32, marginBottom: 24,
                  textAlign: 'center', border: '2px solid #B8D4FE',
                }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1A4DB0', marginBottom: 8 }}>
                    📱 {lang === 'th' ? 'สแกนเพื่อชำระผ่านพร้อมเพย์' : 'Scan to Pay via PromptPay'}
                  </h3>
                  <p style={{ fontSize: 14, color: colors.gray, marginBottom: 20 }}>
                    {lang === 'th' ? 'เปิดแอปธนาคาร สแกน QR ด้านล่าง แล้วโอนจำนวนเงินที่ถูกต้อง' : 'Open your banking app, scan the QR code below, and transfer the exact amount.'}
                  </p>
                  <div style={{
                    background: '#fff', borderRadius: 16, padding: 20, display: 'inline-block',
                    boxShadow: '0 4px 20px rgba(26, 77, 176, 0.15)',
                  }}>
                    <img src={QRCODE_DATA_URI} alt="PromptPay QR Code" style={{
                      width: isMobile ? 200 : 250, height: isMobile ? 200 : 250,
                      borderRadius: 12, objectFit: 'contain',
                    }} />
                  </div>
                  <p style={{ fontSize: 24, fontWeight: 800, color: '#1A4DB0', marginTop: 16 }}>
                    ฿{total.toFixed(2)}
                  </p>
                </div>
              )}

              {/* ---- Crypto Wallet Section ---- */}
              {isCrypto && selectedCrypto && (
                <div style={{
                  background: `linear-gradient(135deg, ${selectedCrypto.color}08 0%, ${selectedCrypto.color}15 100%)`,
                  borderRadius: 20, padding: isMobile ? 20 : 32, marginBottom: 24,
                  textAlign: 'center', border: `2px solid ${selectedCrypto.color}40`,
                }}>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: selectedCrypto.color, marginBottom: 8 }}>
                    {selectedCrypto.icon} {lang === 'th' ? `ชำระด้วย ${selectedCrypto.label}` : `Pay with ${selectedCrypto.label}`}
                  </h3>
                  <p style={{ fontSize: 14, color: colors.gray, marginBottom: 20 }}>
                    {lang === 'th'
                      ? `สแกน QR หรือคัดลอกที่อยู่ด้านล่าง ส่ง ${selectedCrypto.symbol} แล้วอัพโหลดภาพหน้าจอยืนยัน`
                      : `Scan the QR or copy the address below. Send ${selectedCrypto.symbol}, then upload a screenshot.`}
                  </p>

                  {/* QR Code */}
                  <div style={{
                    background: '#fff', borderRadius: 16, padding: 20, display: 'inline-block',
                    boxShadow: `0 4px 20px ${selectedCrypto.color}20`, marginBottom: 20,
                    minWidth: isMobile ? 200 : 250, minHeight: isMobile ? 200 : 250,
                  }}>
                    {!qrLoaded && !qrError && (
                      <div style={{
                        width: isMobile ? 200 : 250, height: isMobile ? 200 : 250,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: colors.gray, fontSize: 14,
                      }}>
                        {lang === 'th' ? 'กำลังสร้าง QR...' : 'Generating QR...'}
                      </div>
                    )}
                    {qrError && (
                      <div style={{
                        width: isMobile ? 200 : 250, height: isMobile ? 200 : 250,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                        color: colors.gray, fontSize: 13, textAlign: 'center', padding: 16,
                      }}>
                        <span style={{ fontSize: 32, marginBottom: 8 }}>📷</span>
                        <span>{lang === 'th' ? 'ไม่สามารถสร้าง QR ได้' : 'QR code unavailable'}</span>
                        <span style={{ fontSize: 11, marginTop: 4 }}>{lang === 'th' ? 'กรุณาคัดลอกที่อยู่ด้านล่าง' : 'Please copy the address below'}</span>
                      </div>
                    )}
                    {cryptoQrUrl && (
                      <img
                        src={cryptoQrUrl}
                        alt={`${selectedCrypto.symbol} wallet QR code`}
                        style={{
                          width: isMobile ? 200 : 250, height: isMobile ? 200 : 250,
                          borderRadius: 12, objectFit: 'contain',
                        }}
                      />
                    )}
                  </div>

                  {/* Wallet Address + Copy */}
                  <div style={{
                    background: '#fff', borderRadius: 16, padding: '16px 20px', marginBottom: 16,
                    boxShadow: `0 4px 20px ${selectedCrypto.color}20`,
                    display: 'inline-block', maxWidth: '100%',
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: colors.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {selectedCrypto.symbol} {lang === 'th' ? 'ที่อยู่กระเป๋า' : 'Wallet Address'}
                    </p>
                    <p style={{
                      fontSize: isMobile ? 10 : 13, fontFamily: 'monospace', color: colors.dark,
                      wordBreak: 'break-all', fontWeight: 600, margin: 0, lineHeight: 1.6,
                      userSelect: 'all', padding: '8px 12px', background: colors.cream, borderRadius: 8,
                    }}>
                      {selectedCrypto.address}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      style={{
                        marginTop: 12, padding: '10px 24px', borderRadius: 20,
                        border: copied ? `2px solid ${colors.primary}` : `2px solid ${selectedCrypto.color}40`,
                        background: copied ? colors.mint : `${selectedCrypto.color}10`,
                        color: copied ? colors.primary : selectedCrypto.color,
                        fontSize: 14, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
                        transition: 'all 0.2s',
                      }}
                    >
                      {copied
                        ? (lang === 'th' ? '✓ คัดลอกแล้ว!' : '✓ Copied!')
                        : (lang === 'th' ? '📋 คัดลอกที่อยู่' : '📋 Copy Address')}
                    </button>
                  </div>

                  {/* Network warning */}
                  <div style={{
                    background: '#FFF3CD', borderRadius: 12, padding: '10px 16px', marginTop: 8,
                    display: 'inline-block',
                  }}>
                    <p style={{ fontSize: 12, color: '#856404', margin: 0, fontWeight: 600 }}>
                      ⚠️ {selectedCrypto.networkNote} — {lang === 'th' ? 'ส่งผิดเครือข่ายอาจทำให้สูญเสียเงิน' : 'Sending on wrong network may result in lost funds'}
                    </p>
                  </div>

                  <p style={{ fontSize: 24, fontWeight: 800, color: selectedCrypto.color, marginTop: 16 }}>
                    ฿{total.toFixed(0)} <span style={{ fontSize: 14, color: colors.gray, fontWeight: 400 }}>
                      ({lang === 'th' ? 'เทียบเท่าในสกุล' : 'equivalent in'} {selectedCrypto.symbol})
                    </span>
                  </p>
                </div>
              )}

              {/* ---- Screenshot Upload (shared for all methods) ---- */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: colors.dark, marginBottom: 12 }}>
                  📸 {isCrypto
                    ? (lang === 'th' ? 'อัพโหลดภาพหน้าจอการโอน' : 'Upload Transfer Screenshot')
                    : (lang === 'th' ? 'อัพโหลดภาพหน้าจอการชำระเงิน' : 'Upload Payment Screenshot')}
                </h4>
                <p style={{ fontSize: 13, color: colors.gray, marginBottom: 16 }}>
                  {isCrypto
                    ? (lang === 'th' ? 'หลังโอนคริปโตแล้ว ถ่ายภาพหน้าจอยืนยันการทำรายการแล้วอัพโหลดด้านล่าง' : 'After sending crypto, take a screenshot of the transaction confirmation and upload it below.')
                    : (lang === 'th' ? 'หลังชำระเงินแล้ว ถ่ายภาพหน้าจอยืนยันแล้วอัพโหลดด้านล่าง' : 'After paying, take a screenshot of the confirmation and upload it below.')}
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
                  capture="environment"
                  onChange={handleProofSelect}
                  style={{ display: 'none' }}
                />

                {!proofPreview ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '100%', padding: 32, borderRadius: 16,
                      border: `3px dashed ${dragActive ? (selectedCrypto?.color || colors.primary) : colors.blush}`,
                      background: dragActive ? colors.mint : 'transparent',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 12, fontFamily: 'Plus Jakarta Sans, sans-serif',
                      transition: 'all 0.3s',
                    }}
                    onMouseOver={e => { if (!dragActive) { e.currentTarget.style.borderColor = selectedCrypto?.color || colors.primary; e.currentTarget.style.background = colors.mint; } }}
                    onMouseOut={e => { if (!dragActive) { e.currentTarget.style.borderColor = colors.blush; e.currentTarget.style.background = 'transparent'; } }}
                  >
                    <span style={{ fontSize: 40 }}>📷</span>
                    <span style={{ fontWeight: 600, color: colors.dark, fontSize: 16 }}>{t('upload_drag')}</span>
                    <span style={{ fontSize: 13, color: colors.gray }}>{t('upload_or_click')}</span>
                  </div>
                ) : (
                  <div>
                    <div style={{
                      position: 'relative', display: 'inline-block',
                      borderRadius: 16, overflow: 'hidden', border: `3px solid ${selectedCrypto?.color || colors.primary}`,
                      boxShadow: `0 4px 20px ${selectedCrypto ? selectedCrypto.color + '30' : 'rgba(45, 125, 70, 0.2)'}`,
                    }}>
                      <img src={proofPreview} alt="Payment proof" style={{
                        maxWidth: '100%', maxHeight: 300, display: 'block',
                      }} />
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: selectedCrypto?.color || colors.primary, color: '#fff',
                        borderRadius: '50%', width: 28, height: 28,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, fontWeight: 700,
                      }}>✓</div>
                    </div>
                    <button type="button" onClick={() => { setProofFile(null); setProofPreview(null); fileInputRef.current.value = ''; }} style={{
                      display: 'block', margin: '12px auto 0', padding: '8px 20px',
                      borderRadius: 20, border: `1px solid ${colors.blush}`,
                      background: colors.white, color: colors.gray,
                      fontSize: 13, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
                    }}>
                      {t('choose_different')}
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="button"
                disabled={loading || !proofFile}
                onClick={handleSubmitOrder}
                style={{
                  width: '100%', padding: isMobile ? '16px 24px' : '20px 40px', borderRadius: 30, minHeight: 44,
                  border: 'none',
                  background: (!proofFile || loading) ? colors.gray : (selectedCrypto ? `linear-gradient(135deg, ${selectedCrypto.color}, ${selectedCrypto.color}CC)` : colors.gradient1),
                  color: colors.white, fontWeight: 700, fontSize: isMobile ? 16 : 18,
                  cursor: (!proofFile || loading) ? 'not-allowed' : 'pointer',
                  boxShadow: proofFile && !loading ? `0 8px 30px ${selectedCrypto ? selectedCrypto.color + '60' : 'rgba(45, 125, 70, 0.4)'}` : 'none',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  transition: 'all 0.3s',
                }}
              >
                {loading ? (proofStatus || t('submitting')) : proofFile ? `${t('confirm_order')} — ฿${total.toFixed(0)}` : t('upload_to_continue')}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

import React, { useState, useRef } from 'react';
import { colors } from '../../shared/theme';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { supabase } from '../../shared/supabase';
import { optimizeImage } from '../../shared/imageUtils';
import { QRCODE_DATA_URI } from '../../shared/qrcode';

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
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofPreview, setProofPreview] = useState(null);
  const [proofFile, setProofFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const paymentMethod = 'promptpay';
  const [fieldErrors, setFieldErrors] = useState({});
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
  const MAX_PROOF_SIZE = 10 * 1024 * 1024; // 10MB max
  const handleProofSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(lang === 'th' ? 'กรุณาอัพโหลดไฟล์รูปภาพ (ภาพหน้าจอการชำระเงิน)' : 'Please upload an image file (screenshot of your payment)');
      return;
    }
    if (file.size > MAX_PROOF_SIZE) {
      setError(lang === 'th' ? 'ไฟล์ใหญ่เกินไป (สูงสุด 10MB)' : 'File too large. Maximum size is 10MB.');
      return;
    }
    setError('');
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProofPreview(ev.target.result);
    reader.readAsDataURL(file);
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
      if (!file.type.startsWith('image/')) {
        setError(lang === 'th' ? 'กรุณาอัพโหลดไฟล์รูปภาพ (ภาพหน้าจอการชำระเงิน)' : 'Please upload an image file (screenshot of your payment)');
        return;
      }
      if (file.size > MAX_PROOF_SIZE) {
        setError(lang === 'th' ? 'ไฟล์ใหญ่เกินไป (สูงสุด 10MB)' : 'File too large. Maximum size is 10MB.');
        return;
      }
      setError('');
      setProofFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setProofPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Submit order (PromptPay QR only)
  const handleSubmitOrder = async () => {
    // Prevent double-submit while Supabase calls are in-flight
    if (loading) return;

    if (paymentMethod === 'promptpay' && !proofFile) {
      setError(lang === 'th' ? 'กรุณาอัพโหลดภาพหน้าจอการชำระเงินก่อน' : 'Please upload your payment screenshot first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sanitize = (str) => str ? str.replace(/[<>"'`\\]/g, '').trim() : '';

      let proofUrl = '';

      // Upload payment proof only for PromptPay
      if (paymentMethod === 'promptpay' && proofFile) {
        // Optimize proof image client-side before upload
        const { file: optimizedProof } = await optimizeImage(proofFile, {
          maxWidth: 1200,
          maxHeight: 1600,
          quality: 0.85,
        });

        const fileExt = optimizedProof.name.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `proofs/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, optimizedProof, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          throw new Error('Failed to upload payment screenshot. Please try again.');
        }

        const { data: urlData } = supabase.storage
          .from('payment-proofs')
          .getPublicUrl(filePath);

        proofUrl = urlData?.publicUrl || '';
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
        throw new Error('Failed to place order. Please try again.');
      }

      onPlaceOrder({ name, phone, address, district, province, postalCode, notes, paymentMethod, total });
    } catch (err) {
      setError(err.message || 'Failed to place order. Please try again.');
      setLoading(false);
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
                    {t('checkout_district')} *
                  </label>
                  <input type="text" value={district} onChange={e => setDistrict(e.target.value)} style={inputStyle}
                    aria-invalid={!!fieldErrors.district}
                    aria-describedby={fieldErrors.district ? 'district-error' : undefined}
                    onFocus={e => e.target.style.borderColor = colors.primary}
                    onBlur={e => e.target.style.borderColor = colors.blush} />
                  {fieldErrors.district && <span id="district-error" style={{ color: colors.error, fontSize: 12, marginTop: 4, display: 'block' }} role="alert">{fieldErrors.district}</span>}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: colors.dark }}>
                    {t('checkout_province')} *
                  </label>
                  <input type="text" value={province} onChange={e => setProvince(e.target.value)} style={inputStyle}
                    aria-invalid={!!fieldErrors.province}
                    aria-describedby={fieldErrors.province ? 'province-error' : undefined}
                    onFocus={e => e.target.style.borderColor = colors.primary}
                    onBlur={e => e.target.style.borderColor = colors.blush} />
                  {fieldErrors.province && <span id="province-error" style={{ color: colors.error, fontSize: 12, marginTop: 4, display: 'block' }} role="alert">{fieldErrors.province}</span>}
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
              {/* PromptPay QR Payment */}
              <div>
              {/* QR Code Display */}
              <div style={{
                background: 'linear-gradient(135deg, #E8F0FE 0%, #F0F7FF 100%)',
                borderRadius: 20, padding: isMobile ? 20 : 32, marginBottom: 24,
                textAlign: 'center', border: '2px solid #B8D4FE',
              }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#1A4DB0', marginBottom: 8 }}>
                  📱 Scan to Pay via PromptPay
                </h3>
                <p style={{ fontSize: 14, color: colors.gray, marginBottom: 20 }}>
                  Open your banking app, scan the QR code below, and transfer the exact amount.
                </p>

                {/* Static QR Code Image */}
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

              {/* Screenshot Upload */}
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: colors.dark, marginBottom: 12 }}>
                  📸 Upload Payment Screenshot
                </h4>
                <p style={{ fontSize: 13, color: colors.gray, marginBottom: 16 }}>
                  After paying, take a screenshot of the confirmation and upload it below.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
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
                      border: `3px dashed ${dragActive ? colors.primary : colors.blush}`,
                      background: dragActive ? colors.mint : 'transparent',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 12, fontFamily: 'Plus Jakarta Sans, sans-serif',
                      transition: 'all 0.3s',
                    }}
                    onMouseOver={e => { if (!dragActive) { e.currentTarget.style.borderColor = colors.primary; e.currentTarget.style.background = colors.mint; } }}
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
                      borderRadius: 16, overflow: 'hidden', border: `3px solid ${colors.primary}`,
                      boxShadow: '0 4px 20px rgba(45, 125, 70, 0.2)',
                    }}>
                      <img src={proofPreview} alt="Payment proof" style={{
                        maxWidth: '100%', maxHeight: 300, display: 'block',
                      }} />
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: colors.primary, color: '#fff',
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

              {/* PromptPay Submit Button */}
              <button
                type="button"
                disabled={loading || !proofFile}
                onClick={handleSubmitOrder}
                style={{
                  width: '100%', padding: isMobile ? '16px 24px' : '20px 40px', borderRadius: 30, minHeight: 44,
                  border: 'none',
                  background: (!proofFile || loading) ? colors.gray : colors.gradient1,
                  color: colors.white, fontWeight: 700, fontSize: isMobile ? 16 : 18,
                  cursor: (!proofFile || loading) ? 'not-allowed' : 'pointer',
                  boxShadow: proofFile && !loading ? '0 8px 30px rgba(45, 125, 70, 0.4)' : 'none',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  transition: 'all 0.3s',
                }}
              >
                {loading ? t('submitting') : proofFile ? `${t('confirm_order')} — ฿${total.toFixed(0)}` : t('upload_to_continue')}
              </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

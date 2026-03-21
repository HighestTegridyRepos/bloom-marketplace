import { useState, useEffect } from 'react';
import { supabase } from '../../shared/supabase';
import { colors, shadows } from '../../shared/theme';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { Confetti } from '../../shared/components/Confetti';
import { useLanguage } from '../hooks/useLanguage';
import { sanitize, exportToCSV } from '../lib/utils';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Spinner } from './ui/Spinner';
import { Alert } from './ui/Alert';
import { ConfirmModal } from './ui/ConfirmModal';
import { ListingCard } from './ListingCard';

export const DashboardScreen = ({ user, profile, onLogout, onEditProfile, onCreateListing, onEditListing }) => {
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [alert, setAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('listings'); // 'listings', 'orders', or 'analytics'
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, listing: null });
  const [cancelConfirm, setCancelConfirm] = useState({ show: false, orderId: null });
  const [statusFilter, setStatusFilter] = useState('all'); // for filtering orders by status
  const [orderSearch, setOrderSearch] = useState(''); // for searching orders by customer name, phone, or order ID

  const fetchListings = async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      setAlert({ type: 'error', message: `Failed to load listings: ${error.message}` });
      setListings([]);
    } else {
      setListings(data || []);
    }
    setLoading(false);
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('seller_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setAlert({ type: 'error', message: `Failed to load orders: ${error.message}` });
      setOrders([]);
    } else {
      setOrders(data || []);
    }
  };

  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const updateOrderStatus = async (orderId, newStatus) => {
    if (updatingOrderId) return;
    setUpdatingOrderId(orderId);

    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      setAlert({ type: 'error', message: `Failed to update order: ${error.message}` });
    } else {
      await fetchOrders();
      setAlert({ type: 'success', message: `Order marked as ${newStatus}` });
    }
    setUpdatingOrderId(null);
  };

  useEffect(() => {
    fetchListings();
    fetchOrders();
  }, [profile.id]);

  const handleToggleAvailability = async (listing) => {
    const { error } = await supabase
      .from('listings')
      .update({ is_available: !listing.is_available })
      .eq('id', listing.id);

    if (error) {
      setAlert({ type: 'error', message: `Failed to update listing: ${error.message}` });
    } else {
      fetchListings();
      setAlert({
        type: 'success',
        message: listing.is_available ? 'Listing hidden from buyers' : 'Listing is now visible!',
      });
    }
  };

  const handleDelete = (listing) => {
    setDeleteConfirm({ show: true, listing });
  };

  const confirmDelete = async () => {
    const listing = deleteConfirm.listing;
    setDeleteConfirm({ show: false, listing: null });

    // Delete images from storage first
    if (listing.images && Array.isArray(listing.images)) {
      const imagePaths = listing.images
        .map(url => {
          try {
            const urlObj = new URL(url);
            const match = urlObj.pathname.match(/\/object\/public\/images\/(.+)/);
            return match ? match[1] : null;
          } catch { return null; }
        })
        .filter(Boolean);
      if (imagePaths.length > 0) {
        await supabase.storage.from('images').remove(imagePaths);
      }
    }

    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listing.id);

    if (error) {
      setAlert({ type: 'error', message: `Failed to delete listing: ${error.message}` });
    } else {
      fetchListings();
      setAlert({ type: 'success', message: 'Listing deleted' });
    }
  };

  const activeListings = listings.filter(l => l.is_available).length;

  return (
    <div className="page-transition" style={{
      minHeight: '100vh',
      background: colors.cream,
    }}>
      <Confetti active={showConfetti} />

      {alert && (
        <Alert
          message={alert.message}
          type={alert.type}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Header */}
      <div style={{
        background: colors.gradient1,
        padding: isMobile ? '16px 12px 60px' : '24px 20px 80px',
        borderRadius: '0 0 32px 32px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="data:image/png;base64,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" width="40" height="40" alt="SiamClones" style={{ borderRadius: 8 }}/>
              <span style={{ fontSize: 20, fontWeight: 800, color: colors.white }}>SiamClones</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <a
                href="/"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  padding: '8px 16px',
                  borderRadius: 20,
                  color: colors.white,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                  textDecoration: 'none',
                  transition: 'all 0.3s ease',
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.25)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.15)'}
              >
                ← Back to Shop
              </a>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                aria-label="Sign out of vendor portal"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 20,
                  color: colors.white,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 14,
                  transition: 'all 0.3s ease',
                }}
                onMouseOver={(e) => e.target.style.background = 'rgba(255,255,255,0.3)'}
                onMouseOut={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
              >
                {t('sign_out')}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: colors.white,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {profile.profile_photo_url ? (
                <img src={profile.profile_photo_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 28 }}>🌿</span>
              )}
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: colors.white, marginBottom: 4 }}>
                {t('greeting', { name: profile.display_name })}
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
                {profile.farm_name || profile.location || t('welcome_dashboard')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ maxWidth: 800, margin: '-48px auto 0', padding: '0 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 24 }}>
          <Card style={{ textAlign: 'center', padding: 20 }}>
            <p style={{ fontSize: 32, fontWeight: 800, color: colors.primary, marginBottom: 4 }}>
              {listings.length}
            </p>
            <p style={{ fontSize: 14, color: colors.gray }}>{t('stat_listings')}</p>
          </Card>
          <Card style={{ textAlign: 'center', padding: 20 }}>
            <p style={{ fontSize: 32, fontWeight: 800, color: colors.secondary, marginBottom: 4 }}>
              {orders.filter(o => o.status === 'pending').length}
            </p>
            <p style={{ fontSize: 14, color: colors.gray }}>{t('stat_new_orders')}</p>
          </Card>
          <Card style={{ textAlign: 'center', padding: 20 }}>
            <p style={{ fontSize: 32, fontWeight: 800, color: colors.mint, marginBottom: 4 }}>
              {orders.length}
            </p>
            <p style={{ fontSize: 14, color: colors.gray }}>{t('stat_total_orders')}</p>
          </Card>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          <Button
            onClick={() => {
              setShowConfetti(true);
              setTimeout(() => setShowConfetti(false), 2000);
              onCreateListing();
            }}
            style={{ flex: 1 }}
          >
            {t('new_listing')}
          </Button>
          <Button
            variant="secondary"
            onClick={onEditProfile}
            style={{ flex: 1 }}
          >
            {t('edit_profile')}
          </Button>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <button
            onClick={() => setActiveTab('listings')}
            style={{
              flex: isMobile ? '1 1 calc(33.33% - 6px)' : 1,
              padding: isMobile ? '12px 8px' : '14px 20px',
              borderRadius: 12,
              border: 'none',
              background: activeTab === 'listings' ? colors.gradient1 : colors.white,
              color: activeTab === 'listings' ? colors.white : colors.dark,
              fontWeight: 600,
              fontSize: isMobile ? 13 : 16,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t('tab_listings')} ({listings.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              flex: isMobile ? '1 1 calc(33.33% - 6px)' : 1,
              padding: isMobile ? '12px 8px' : '14px 20px',
              borderRadius: 12,
              border: 'none',
              background: activeTab === 'orders' ? colors.gradient1 : colors.white,
              color: activeTab === 'orders' ? colors.white : colors.dark,
              fontWeight: 600,
              fontSize: isMobile ? 13 : 16,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              position: 'relative',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t('tab_orders')} ({orders.length})
            {orders.filter(o => o.status === 'pending').length > 0 && (
              <span style={{
                position: 'absolute',
                top: -5,
                right: -5,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: colors.primary,
                color: colors.white,
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {orders.filter(o => o.status === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              flex: isMobile ? '1 1 calc(33.33% - 6px)' : 1,
              padding: isMobile ? '12px 8px' : '14px 20px',
              borderRadius: 12,
              border: 'none',
              background: activeTab === 'analytics' ? colors.gradient1 : colors.white,
              color: activeTab === 'analytics' ? colors.white : colors.dark,
              fontWeight: 600,
              fontSize: isMobile ? 13 : 16,
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t('tab_analytics')}
          </button>
        </div>

        {/* Content based on tab */}
        {activeTab === 'orders' ? (
          /* Orders Tab */
          <div style={{ marginBottom: 32 }}>
            {/* Search and Status Filter */}
            {orders.length > 0 && (
              <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Search Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="text"
                    placeholder={t('search_orders')}
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: `1px solid ${colors.gray}`,
                      background: colors.white,
                      color: colors.dark,
                      fontSize: 14,
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                    }}
                  />
                  {orderSearch && (
                    <button
                      onClick={() => setOrderSearch('')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: `1px solid ${colors.gray}`,
                        background: colors.white,
                        color: colors.gray,
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: 'pointer',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = colors.lightGray;
                        e.target.style.color = colors.dark;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = colors.white;
                        e.target.style.color = colors.gray;
                      }}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Status Filter Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontWeight: 600, color: colors.dark, fontSize: 14 }}>{t('filter_status')}</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: `1px solid ${colors.gray}`,
                      background: colors.white,
                      color: colors.dark,
                      fontWeight: 500,
                      fontSize: 14,
                      cursor: 'pointer',
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                    }}
                  >
                    <option value="all">{t('all_orders')}</option>
                    <option value="pending">{t('status_pending')}</option>
                    <option value="confirmed">{t('status_confirmed')}</option>
                    <option value="shipped">{t('status_shipped')}</option>
                    <option value="delivered">{t('status_delivered')}</option>
                    <option value="cancelled">{t('status_cancelled')}</option>
                  </select>
                  {statusFilter !== 'all' && (
                    <button
                      onClick={() => setStatusFilter('all')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: `1px solid ${colors.gray}`,
                        background: colors.white,
                        color: colors.gray,
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: 'pointer',
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = colors.lightGray;
                        e.target.style.color = colors.dark;
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = colors.white;
                        e.target.style.color = colors.gray;
                      }}
                      title="Clear status filter"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Export Orders Button */}
            {orders.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <Button
                  onClick={() => {
                    const filteredOrders = orders.filter(order => {
                      const statusMatch = statusFilter === 'all' || order.status === statusFilter;
                      if (!orderSearch) {
                        return statusMatch;
                      }
                      const searchLower = orderSearch.toLowerCase();
                      const customerNameMatch = order.customer_name && order.customer_name.toLowerCase().includes(searchLower);
                      const customerPhoneMatch = order.customer_phone && order.customer_phone.includes(orderSearch);
                      const orderIdMatch = order.id && order.id.toString().includes(orderSearch);
                      return statusMatch && (customerNameMatch || customerPhoneMatch || orderIdMatch);
                    });

                    const columns = [
                      { label: 'Order ID', accessor: (o) => o.id },
                      { label: 'Customer Name', accessor: (o) => o.customer_name },
                      { label: 'Phone', accessor: (o) => o.customer_phone },
                      { label: 'Status', accessor: (o) => o.status },
                      { label: 'Total', accessor: (o) => `฿${parseFloat(o.total).toFixed(2)}` },
                      { label: 'Items', accessor: (o) => Array.isArray(o.items) ? o.items.map(item => item.title).join(', ') : '' },
                      { label: 'Date', accessor: (o) => new Date(o.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) }
                    ];

                    const timestamp = new Date().toLocaleDateString('th-TH');
                    exportToCSV(filteredOrders, columns, `orders_${timestamp}.csv`);
                  }}
                  style={{ padding: '12px 20px', fontSize: 14 }}
                >
                  {t('export_orders')}
                </Button>
              </div>
            )}

            {loading ? (
              <Card style={{ textAlign: 'center', padding: 40 }}>
                <Spinner size={32} />
                <p style={{ color: colors.gray, marginTop: 12 }}>Loading orders...</p>
              </Card>
            ) : orders.length === 0 ? (
              <Card style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
                <h3 style={{ fontSize: 20, fontWeight: 600, color: colors.dark, marginBottom: 8 }}>
                  {t('no_orders')}
                </h3>
                <p style={{ color: colors.gray }}>
                  {t('no_orders_sub')}
                </p>
              </Card>
            ) : (
              orders
                .filter(order => {
                  // Filter by status
                  const statusMatch = statusFilter === 'all' || order.status === statusFilter;

                  // Filter by search term
                  if (!orderSearch) {
                    return statusMatch;
                  }

                  const searchLower = orderSearch.toLowerCase();
                  const customerNameMatch = order.customer_name && order.customer_name.toLowerCase().includes(searchLower);
                  const customerPhoneMatch = order.customer_phone && order.customer_phone.includes(orderSearch);
                  const orderIdMatch = order.id && order.id.toString().includes(orderSearch);

                  return statusMatch && (customerNameMatch || customerPhoneMatch || orderIdMatch);
                })
                .map(order => (
                <Card key={order.id} style={{ marginBottom: 16, padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        background: order.status === 'pending' ? colors.accent :
                                   order.status === 'confirmed' ? colors.primary :
                                   order.status === 'shipped' ? colors.lavender :
                                   order.status === 'delivered' ? colors.mint :
                                   order.status === 'cancelled' ? colors.error : colors.lightGray,
                        color: order.status === 'pending' ? colors.dark : colors.white,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        {order.status === 'pending' ? t('status_pending') :
                         order.status === 'confirmed' ? t('status_confirmed') :
                         order.status === 'shipped' ? t('status_shipped') :
                         order.status === 'delivered' ? t('status_delivered') :
                         order.status === 'cancelled' ? t('status_cancelled') : order.status}
                      </span>
                      <p style={{ fontSize: 12, color: colors.gray, marginTop: 8 }}>
                        {new Date(order.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p style={{ fontSize: 24, fontWeight: 800, color: colors.primary }}>
                      ฿{parseFloat(order.total).toFixed(0)}
                    </p>
                  </div>

                  {/* Items */}
                  <div style={{ background: colors.cream, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    {Array.isArray(order.items) && order.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: i < order.items.length - 1 ? 8 : 0 }}>
                        <span style={{ color: colors.dark }}>{item.title} × {item.quantity}</span>
                        <span style={{ fontWeight: 600, color: colors.dark }}>฿{(item.price * item.quantity).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Customer Info */}
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontWeight: 600, color: colors.dark, marginBottom: 8 }}>
                      👤 {sanitize(order.customer_name)}
                    </p>
                    <p style={{ fontSize: 14, color: colors.gray, marginBottom: 4 }}>
                      📱 {order.customer_phone}
                    </p>
                    <p style={{ fontSize: 14, color: colors.gray }}>
                      📍 {sanitize(order.address)}, {sanitize(order.district)}, {sanitize(order.province)} {order.postal_code}
                    </p>
                    {order.delivery_notes && (
                      <p style={{ fontSize: 14, color: colors.lavender, marginTop: 8 }}>
                        📝 {order.delivery_notes}
                      </p>
                    )}
                  </div>

                  {/* Payment Method & Proof */}
                  <div style={{
                    marginBottom: 16, padding: 16, borderRadius: 12,
                    background: ['btc','eth','sol'].includes(order.payment_method)
                      ? `linear-gradient(135deg, ${{'btc':'#F7931A','eth':'#627EEA','sol':'#9945FF'}[order.payment_method]}08 0%, ${{'btc':'#F7931A','eth':'#627EEA','sol':'#9945FF'}[order.payment_method]}15 100%)`
                      : order.payment_method === 'promptpay'
                        ? 'linear-gradient(135deg, #E8F0FE 0%, #F0F7FF 100%)'
                        : colors.cream,
                    border: ['btc','eth','sol'].includes(order.payment_method)
                      ? `1px solid ${{'btc':'#F7931A','eth':'#627EEA','sol':'#9945FF'}[order.payment_method]}40`
                      : order.payment_method === 'promptpay' ? '1px solid #B8D4FE' : `1px solid ${colors.blush}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: order.payment_proof_url ? 12 : 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: colors.dark }}>
                        {{'btc':'₿','eth':'Ξ','sol':'◎'}[order.payment_method] || '💳'} {t(`payment_method_${order.payment_method}`) || order.payment_method}
                      </span>
                      {order.payment_method !== 'cod' && (
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
                          background: order.payment_proof_url ? '#C8E6C9' : '#FFF3CD',
                          color: order.payment_proof_url ? '#2E7D32' : '#856404',
                        }}>
                          {order.payment_proof_url ? `✅ ${t('payment_proof_verified')}` : `⏳ ${t('payment_proof_none')}`}
                        </span>
                      )}
                    </div>

                    {order.payment_proof_url && (
                      <div>
                        <a
                          href={order.payment_proof_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            textDecoration: 'none', color: 'inherit',
                            padding: 10, borderRadius: 10, background: 'rgba(255,255,255,0.8)',
                            border: `1px solid ${colors.blush}`, cursor: 'pointer',
                            transition: 'box-shadow 0.2s',
                          }}
                          onMouseOver={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(45,125,70,0.15)'}
                          onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                          <img
                            src={order.payment_proof_url}
                            alt="Payment proof"
                            style={{
                              width: 56, height: 56, borderRadius: 8,
                              objectFit: 'cover', border: `1px solid ${colors.blush}`,
                              flexShrink: 0,
                            }}
                            onError={e => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div style={{
                            width: 56, height: 56, borderRadius: 8,
                            background: colors.cream, display: 'none',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: 24, flexShrink: 0,
                          }}>📷</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14, fontWeight: 600, color: '#1A4DB0' }}>
                              📸 {t('payment_proof_view')}
                            </p>
                            <p style={{ fontSize: 12, color: colors.gray, marginTop: 2 }}>
                              {t('payment_proof')} — ฿{parseFloat(order.total).toFixed(0)}
                            </p>
                          </div>
                          <span style={{ fontSize: 18, color: colors.gray }}>↗</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {order.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Button
                        onClick={() => updateOrderStatus(order.id, 'confirmed')}
                        style={{ flex: 1, padding: '12px 16px', fontSize: 14 }}
                      >
                        {t('btn_confirm')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setCancelConfirm({ show: true, orderId: order.id })}
                        style={{ padding: '12px 16px', fontSize: 14, color: colors.error }}
                      >
                        {t('btn_cancel_order')}
                      </Button>
                    </div>
                  )}
                  {order.status === 'confirmed' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <Button
                        onClick={() => updateOrderStatus(order.id, 'shipped')}
                        style={{ flex: 1, padding: '12px 16px', fontSize: 14 }}
                      >
                        {t('btn_ship')}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setCancelConfirm({ show: true, orderId: order.id })}
                        style={{ padding: '12px 16px', fontSize: 14, color: colors.error }}
                      >
                        {t('btn_cancel_order')}
                      </Button>
                    </div>
                  )}
                  {order.status === 'shipped' && (
                    <Button
                      variant="success"
                      onClick={() => updateOrderStatus(order.id, 'delivered')}
                      fullWidth
                      style={{ padding: '12px 16px', fontSize: 14 }}
                    >
                      {t('btn_deliver')}
                    </Button>
                  )}
                  {order.status === 'delivered' && (
                    <div style={{
                      padding: '12px 16px',
                      background: colors.mint,
                      color: colors.white,
                      borderRadius: 8,
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: 14,
                    }}>
                      ✅ Completed
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        ) : activeTab === 'analytics' ? (
          /* Analytics Tab */
          <div style={{ marginBottom: 32 }}>
            {loading ? (
              <Card style={{ textAlign: 'center', padding: 40 }}>
                <Spinner size={32} />
                <p style={{ color: colors.gray, marginTop: 12 }}>Loading analytics...</p>
              </Card>
            ) : (
              <div>
                {/* Stats Cards Row */}
                {(() => {
                  const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
                  const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;
                  const activeCount = listings.filter(l => l.is_available).length;
                  return (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
                  {/* Total Revenue */}
                  <Card style={{ padding: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: colors.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('analytics_revenue')}</p>
                    <p style={{ fontSize: 32, fontWeight: 800, color: colors.primary, marginBottom: 4 }}>
                      ฿{totalRevenue.toFixed(0)}
                    </p>
                    <p style={{ fontSize: 12, color: colors.gray }}>From {orders.length} orders</p>
                  </Card>

                  {/* Total Orders */}
                  <Card style={{ padding: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: colors.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('analytics_orders_count')}</p>
                    <p style={{ fontSize: 32, fontWeight: 800, color: colors.secondary, marginBottom: 4 }}>
                      {orders.length}
                    </p>
                    <p style={{ fontSize: 12, color: colors.gray }}>All time</p>
                  </Card>

                  {/* Active Listings */}
                  <Card style={{ padding: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: colors.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Active Listings</p>
                    <p style={{ fontSize: 32, fontWeight: 800, color: colors.mint, marginBottom: 4 }}>
                      {activeCount}
                    </p>
                    <p style={{ fontSize: 12, color: colors.gray }}>Out of {listings.length}</p>
                  </Card>

                  {/* Average Order Value */}
                  <Card style={{ padding: 20 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: colors.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('analytics_avg_order')}</p>
                    <p style={{ fontSize: 32, fontWeight: 800, color: colors.lavender, marginBottom: 4 }}>
                      ฿{avgOrder.toFixed(0)}
                    </p>
                    <p style={{ fontSize: 12, color: colors.gray }}>Per order</p>
                  </Card>
                </div>
                  );
                })()}

                {/* Orders by Day Chart */}
                {orders.length > 0 && (
                  <Card style={{ padding: 24, marginBottom: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: colors.dark, marginBottom: 20 }}>{t('analytics_daily')}</h3>
                    {(() => {
                      const last7Days = Array.from({length: 7}, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return d;
                      });
                      const ordersByDay = last7Days.map(day => ({
                        label: day.toLocaleDateString('en', {weekday: 'short'}),
                        count: orders.filter(o => {
                          const od = new Date(o.created_at);
                          return od.toDateString() === day.toDateString();
                        }).length
                      }));
                      const maxCount = Math.max(...ordersByDay.map(d => d.count), 1);
                      return (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 200 }}>
                          {ordersByDay.map((day, idx) => (
                            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                              <div style={{
                                width: '100%',
                                height: `${(day.count / maxCount) * 150}px`,
                                background: colors.gradient1,
                                borderRadius: '8px 8px 0 0',
                                boxShadow: shadows.soft,
                              }}></div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: colors.dark, textAlign: 'center' }}>{day.label}</div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: colors.primary }}>{day.count}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </Card>
                )}

                {/* Top Listings */}
                {orders.length > 0 && (
                  <Card style={{ padding: 24, marginBottom: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: colors.dark, marginBottom: 20 }}>{t('analytics_top')}</h3>
                    {(() => {
                      const itemCounts = {};
                      orders.forEach(order => {
                        if (Array.isArray(order.items)) {
                          order.items.forEach(item => {
                            if (!itemCounts[item.title]) {
                              itemCounts[item.title] = { title: item.title, count: 0, total: 0, image: item.image };
                            }
                            itemCounts[item.title].count += item.quantity || 1;
                            itemCounts[item.title].total += (item.price * (item.quantity || 1)) || 0;
                          });
                        }
                      });
                      const topItems = Object.values(itemCounts)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 3);
                      return (
                        <div>
                          {topItems.length === 0 ? (
                            <p style={{ color: colors.gray }}>No product data available</p>
                          ) : (
                            topItems.map((item, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: idx < topItems.length - 1 ? 16 : 0, paddingBottom: idx < topItems.length - 1 ? 16 : 0, borderBottom: idx < topItems.length - 1 ? `1px solid ${colors.lightGray}` : 'none' }}>
                                <div style={{ fontSize: 28, fontWeight: 700, color: colors.primary, minWidth: 40, textAlign: 'center' }}>#{idx + 1}</div>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontWeight: 600, color: colors.dark, marginBottom: 4 }}>{item.title}</p>
                                  <p style={{ fontSize: 14, color: colors.gray }}>{item.count} {item.count === 1 ? 'unit' : 'units'} • ฿{item.total.toFixed(0)} revenue</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })()}
                  </Card>
                )}

                {/* Revenue Breakdown by Payment Method */}
                {orders.length > 0 && (
                  <Card style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: colors.dark, marginBottom: 20 }}>Revenue by Payment Method</h3>
                    {(() => {
                      const paymentBreakdown = {
                        cod: { label: 'PromptPay (Legacy)', amount: 0 },
                        promptpay: { label: 'PromptPay', amount: 0 },
                        btc: { label: 'Bitcoin (BTC)', amount: 0 },
                        eth: { label: 'Ethereum (ETH)', amount: 0 },
                        sol: { label: 'Solana (SOL)', amount: 0 },
                      };
                      orders.forEach(order => {
                        const method = (order.payment_method || 'cod').toLowerCase();
                        if (paymentBreakdown[method]) {
                          paymentBreakdown[method].amount += parseFloat(order.total) || 0;
                        }
                      });
                      const totalRevenue = Object.values(paymentBreakdown).reduce((sum, p) => sum + p.amount, 0);
                      return (
                        <div>
                          {Object.entries(paymentBreakdown).map(([key, method], idx) => {
                            const percentage = totalRevenue > 0 ? ((method.amount / totalRevenue) * 100).toFixed(1) : 0;
                            return (
                              <div key={key} style={{ marginBottom: idx === Object.keys(paymentBreakdown).length - 1 ? 0 : 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <p style={{ fontWeight: 600, color: colors.dark }}>{method.label}</p>
                                  <p style={{ fontSize: 14, fontWeight: 700, color: colors.primary }}>฿{method.amount.toFixed(0)}</p>
                                </div>
                                <div style={{ width: '100%', height: 8, background: colors.lightGray, borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ width: `${percentage}%`, height: '100%', background: key === 'promptpay' ? colors.lavender : colors.secondary, borderRadius: 4 }}></div>
                                </div>
                                <p style={{ fontSize: 12, color: colors.gray, marginTop: 4 }}>{percentage}% of total</p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </Card>
                )}

                {orders.length === 0 && (
                  <Card style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>📊</div>
                    <h3 style={{ fontSize: 20, fontWeight: 600, color: colors.dark, marginBottom: 8 }}>
                      No data yet
                    </h3>
                    <p style={{ color: colors.gray }}>
                      Analytics will appear here once you receive your first order!
                    </p>
                  </Card>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Listings Tab */
          <div style={{ marginBottom: 32 }}>

          {/* Export Listings Button */}
          {listings.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Button
                onClick={() => {
                  const columns = [
                    { label: 'Title', accessor: (l) => l.title },
                    { label: 'Category', accessor: (l) => l.category },
                    { label: 'Price', accessor: (l) => `฿${parseFloat(l.price).toFixed(2)}` },
                    { label: 'Price Unit', accessor: (l) => l.price_unit },
                    { label: 'Quantity', accessor: (l) => l.quantity },
                    { label: 'Status', accessor: (l) => l.is_available ? 'Active' : 'Hidden' },
                    { label: 'Created Date', accessor: (l) => new Date(l.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) }
                  ];

                  const timestamp = new Date().toLocaleDateString('th-TH');
                  exportToCSV(listings, columns, `listings_${timestamp}.csv`);
                }}
                style={{ padding: '12px 20px', fontSize: 14 }}
              >
                {t('export_listings')}
              </Button>
            </div>
          )}

          {loading ? (
            <Card style={{ textAlign: 'center', padding: 40 }}>
              <Spinner size={32} />
              <p style={{ color: colors.gray, marginTop: 12 }}>Loading listings...</p>
            </Card>
          ) : listings.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: 48 }}>
              <div className="animate-float" style={{ fontSize: 64, marginBottom: 16 }}>🌱</div>
              <h3 style={{ fontSize: 20, fontWeight: 600, color: colors.dark, marginBottom: 8 }}>
                {t('no_listings')}
              </h3>
              <p style={{ color: colors.gray, marginBottom: 24 }}>
                {t('no_listings_sub')}
              </p>
              <Button onClick={onCreateListing}>
                {t('create_first')}
              </Button>
            </Card>
          ) : (
            listings.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onEdit={onEditListing}
                onToggleAvailability={handleToggleAvailability}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
        )}
      </div>

      {/* Delete Listing Confirmation Modal */}
      <ConfirmModal
        show={deleteConfirm.show}
        title={t('confirm_delete')}
        message={`${t('confirm_delete')} "${deleteConfirm.listing?.title}"`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ show: false, listing: null })}
        confirmText={t('btn_confirm_yes')}
        cancelText={t('btn_cancel_modal')}
        isDangerous={true}
      />

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        show={showLogoutConfirm}
        title={t('confirm_logout')}
        message={t('confirm_logout')}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          onLogout();
        }}
        onCancel={() => setShowLogoutConfirm(false)}
        confirmText={t('btn_confirm_logout')}
        cancelText={t('btn_cancel_modal')}
      />

      {/* Order Cancellation Confirmation Modal */}
      <ConfirmModal
        show={cancelConfirm.show}
        title={t('confirm_cancel_order')}
        message={t('confirm_cancel_order')}
        onConfirm={() => {
          updateOrderStatus(cancelConfirm.orderId, 'cancelled');
          setCancelConfirm({ show: false, orderId: null });
        }}
        onCancel={() => setCancelConfirm({ show: false, orderId: null })}
        confirmText={t('btn_cancel_order')}
        cancelText={t('btn_cancel_modal')}
        isDangerous={true}
      />
    </div>
  );
};


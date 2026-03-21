// =============================================
// TRANSLATIONS (i18n) - Seller Portal
// =============================================
export const translations = {
      en: {
        // Auth/Login
        sign_in: 'Sign In 🌿',
        create_account: 'Create Account 🌱',
        email: 'Email',
        password: 'Password',
        confirm_password: 'Confirm Password',
        signing_in: 'Signing in...',
        creating_account: 'Creating account...',

        // Setup/Onboarding
        setup_required: 'Setup Required',
        setup_required_desc: 'To use this app, please complete your seller profile first.',
        setup_profile: 'Setup Profile',
        step_basics: "Let's start with the basics 🌿",
        step_basics_sub: 'Tell us about yourself',
        display_name: 'Display Name',
        farm_name: 'Farm / Business Name',
        phone: 'Phone Number',
        bio: 'Short Bio',
        step_operation: 'Tell us about your operation ☀️',
        step_operation_sub: 'This helps buyers find you',
        location: 'Province / Location',
        website: 'Website URL',
        step_final: 'Final touches ✨',
        step_final_sub: 'Connect with your customers',
        line_id: 'LINE ID',
        order_notifications: 'Order Notifications',
        notification_email: 'Notification Email',
        promptpay_section: 'PromptPay Payment',
        promptpay_id: 'PromptPay ID',
        btn_back: '← Back',
        btn_continue: 'Continue →',
        btn_complete: 'Complete Setup 🎉',
        btn_skip: 'Skip for now →',

        // Dashboard
        greeting: 'Hey, {name}! 👋',
        welcome_dashboard: 'Welcome to your seller dashboard',
        sign_out: 'Sign Out',

        // Stats
        stat_listings: 'Listings',
        stat_new_orders: 'New Orders',
        stat_total_orders: 'Total Orders',

        // Actions
        new_listing: '+ New Listing',
        edit_profile: '✏️ Edit Profile',

        // Tabs
        tab_listings: '📦 Listings',
        tab_orders: '🛒 Orders',
        tab_analytics: '📊 Analytics',

        // Listing form
        edit_listing: 'Edit Listing ✏️',
        create_listing: 'Create Listing 🌱',
        listing_title: 'Title',
        listing_desc: 'Description',
        listing_category: 'Category',
        listing_price: 'Price (THB)',
        listing_price_unit: 'Price Unit',
        listing_quantity: 'Quantity Available',
        listing_strain: 'Strain Name',
        listing_photos: 'Photos',
        upload_photo: '📷 Upload Photo',
        save_listing: 'Save Listing',
        saving: 'Saving...',
        listing_created: 'Listing created successfully! Redirecting...',
        cancel: 'Cancel',

        // Listing cards
        status_active: '✓ Active',
        status_hidden: 'Hidden',
        btn_edit: '✏️ Edit',
        btn_hide: '👁️ Hide',
        btn_show: '👁️ Show',
        btn_delete: '🗑️ Delete',
        listing_hidden_msg: 'Listing hidden from buyers',
        listing_shown_msg: 'Listing is now visible!',
        per_unit: 'per unit',

        // Orders section
        filter_status: 'Filter by Status:',
        all_orders: 'All Orders',
        status_pending: '⏳ Pending',
        status_confirmed: '✅ Confirmed',
        status_shipped: '📦 Shipped',
        status_delivered: '✅ Delivered',
        status_cancelled: '✕ Cancelled',
        no_orders: 'No orders yet',
        no_orders_sub: 'Orders will appear here when customers purchase your listings',
        order_items: 'Items:',
        order_total: 'Total:',
        order_customer: 'Customer:',
        order_phone: 'Phone:',
        order_address: 'Address:',
        order_payment: 'Payment:',
        payment_proof: 'Payment Proof',
        payment_proof_view: 'View Screenshot',
        payment_proof_verified: 'Screenshot Uploaded',
        payment_proof_none: 'No proof uploaded',
        payment_method_promptpay: 'PromptPay',
        payment_method_cod: 'Cash on Delivery',
        payment_method_btc: 'Bitcoin (BTC)',
        payment_method_eth: 'Ethereum (ETH)',
        payment_method_sol: 'Solana (SOL)',
        btn_confirm: '✅ Confirm',
        btn_ship: '📦 Mark Shipped',
        btn_deliver: '✅ Delivered',
        btn_cancel_order: '✕ Cancel',
        search_orders: 'Search by name, phone, or order ID...',

        // Analytics
        analytics_revenue: 'Total Revenue',
        analytics_orders_count: 'Orders',
        analytics_avg_order: 'Avg Order',
        analytics_daily: 'Orders by Day (Last 7 Days)',
        analytics_top: 'Top 3 Products',
        analytics_status: 'Orders by Status',

        // Empty states
        no_listings: "You haven't created any listings yet",
        no_listings_sub: 'Create your first listing to start selling!',
        create_first: 'Create Your First Listing 🌱',

        // Modals
        confirm_delete: 'Are you sure you want to delete this listing? This action cannot be undone.',
        confirm_logout: 'Are you sure you want to sign out?',
        confirm_cancel_order: 'Are you sure you want to cancel this order? This action cannot be undone.',
        btn_confirm_yes: 'Yes, Delete',
        btn_confirm_logout: 'Yes, Sign Out',
        btn_cancel_modal: 'Cancel',

        // Error states
        error_generic: 'Something went wrong',
        error_reload: 'Refresh Page',
        retry: 'Retry',

        // CSV Export
        export_csv: 'Export CSV',
        export_listings: 'Export Listings',
        export_orders: 'Export Orders',
      },
      th: {
        // Auth/Login
        sign_in: 'เข้าสู่ระบบ 🌿',
        create_account: 'สร้างบัญชี 🌱',
        email: 'อีเมล',
        password: 'รหัสผ่าน',
        confirm_password: 'ยืนยันรหัสผ่าน',
        signing_in: 'กำลังเข้าสู่ระบบ...',
        creating_account: 'กำลังสร้างบัญชี...',

        // Setup/Onboarding
        setup_required: 'ต้องตั้งค่า',
        setup_required_desc: 'กรุณาตั้งค่าโปรไฟล์ผู้ขายก่อนใช้งาน',
        setup_profile: 'ตั้งค่าโปรไฟล์',
        step_basics: 'เริ่มต้นกัน 🌿',
        step_basics_sub: 'บอกเราเกี่ยวกับตัวคุณ',
        display_name: 'ชื่อที่แสดง',
        farm_name: 'ชื่อฟาร์ม / ธุรกิจ',
        phone: 'เบอร์โทรศัพท์',
        bio: 'ข้อมูลสั้นๆ',
        step_operation: 'บอกเราเกี่ยวกับกิจการของคุณ ☀️',
        step_operation_sub: 'ช่วยให้ผู้ซื้อค้นพบคุณ',
        location: 'จังหวัด / ที่ตั้ง',
        website: 'เว็บไซต์',
        step_final: 'ขั้นตอนสุดท้าย ✨',
        step_final_sub: 'เชื่อมต่อกับลูกค้าของคุณ',
        line_id: 'ไลน์ไอดี',
        order_notifications: 'การแจ้งเตือนออเดอร์',
        notification_email: 'อีเมลรับแจ้งเตือน',
        promptpay_section: 'ชำระเงิน PromptPay',
        promptpay_id: 'หมายเลข PromptPay',
        btn_back: '← กลับ',
        btn_continue: 'ต่อไป →',
        btn_complete: 'ตั้งค่าเสร็จสิ้น 🎉',
        btn_skip: 'ข้ามไปก่อน →',

        // Dashboard
        greeting: 'สวัสดี, {name}! 👋',
        welcome_dashboard: 'ยินดีต้อนรับสู่แดชบอร์ดผู้ขาย',
        sign_out: 'ออกจากระบบ',

        // Stats
        stat_listings: 'รายการ',
        stat_new_orders: 'ออเดอร์ใหม่',
        stat_total_orders: 'ออเดอร์ทั้งหมด',

        // Actions
        new_listing: '+ รายการใหม่',
        edit_profile: '✏️ แก้ไขโปรไฟล์',

        // Tabs
        tab_listings: '📦 รายการ',
        tab_orders: '🛒 ออเดอร์',
        tab_analytics: '📊 สถิติ',

        // Listing form
        edit_listing: 'แก้ไขรายการ ✏️',
        create_listing: 'สร้างรายการ 🌱',
        listing_title: 'ชื่อ',
        listing_desc: 'รายละเอียด',
        listing_category: 'หมวดหมู่',
        listing_price: 'ราคา (บาท)',
        listing_price_unit: 'หน่วยราคา',
        listing_quantity: 'จำนวนที่มี',
        listing_strain: 'ชื่อสายพันธุ์',
        listing_photos: 'รูปภาพ',
        upload_photo: '📷 อัพโหลดรูป',
        save_listing: 'บันทึกรายการ',
        saving: 'กำลังบันทึก...',
        listing_created: 'สร้างรายการสำเร็จ! กำลังเปลี่ยนหน้า...',
        cancel: 'ยกเลิก',

        // Listing cards
        status_active: '✓ เปิดขาย',
        status_hidden: 'ซ่อน',
        btn_edit: '✏️ แก้ไข',
        btn_hide: '👁️ ซ่อน',
        btn_show: '👁️ แสดง',
        btn_delete: '🗑️ ลบ',
        listing_hidden_msg: 'ซ่อนรายการจากผู้ซื้อแล้ว',
        listing_shown_msg: 'รายการแสดงอยู่แล้ว!',
        per_unit: 'ต่อหน่วย',

        // Orders section
        filter_status: 'กรองตามสถานะ:',
        all_orders: 'ออเดอร์ทั้งหมด',
        status_pending: '⏳ รอดำเนินการ',
        status_confirmed: '✅ ยืนยันแล้ว',
        status_shipped: '📦 จัดส่งแล้ว',
        status_delivered: '✅ ส่งถึงแล้ว',
        status_cancelled: '✕ ยกเลิก',
        no_orders: 'ยังไม่มีออเดอร์',
        no_orders_sub: 'ออเดอร์จะแสดงที่นี่เมื่อลูกค้าสั่งซื้อ',
        order_items: 'รายการ:',
        order_total: 'รวม:',
        order_customer: 'ลูกค้า:',
        order_phone: 'โทร:',
        order_address: 'ที่อยู่:',
        order_payment: 'การชำระ:',
        payment_proof: 'หลักฐานการชำระ',
        payment_proof_view: 'ดูภาพหน้าจอ',
        payment_proof_verified: 'อัพโหลดภาพหน้าจอแล้ว',
        payment_proof_none: 'ยังไม่มีหลักฐานการชำระ',
        payment_method_promptpay: 'พร้อมเพย์',
        payment_method_cod: 'เก็บเงินปลายทาง',
        payment_method_btc: 'บิตคอยน์ (BTC)',
        payment_method_eth: 'อีเธอเรียม (ETH)',
        payment_method_sol: 'โซลานา (SOL)',
        btn_confirm: '✅ ยืนยัน',
        btn_ship: '📦 จัดส่งแล้ว',
        btn_deliver: '✅ ส่งถึงแล้ว',
        btn_cancel_order: '✕ ยกเลิก',
        search_orders: 'ค้นหาด้วยชื่อ เบอร์โทร หรือรหัสออเดอร์...',

        // Analytics
        analytics_revenue: 'รายได้ทั้งหมด',
        analytics_orders_count: 'ออเดอร์',
        analytics_avg_order: 'เฉลี่ยต่อออเดอร์',
        analytics_daily: 'ออเดอร์ตามวัน (7 วันล่าสุด)',
        analytics_top: 'สินค้าขายดี 3 อันดับ',
        analytics_status: 'ออเดอร์ตามสถานะ',

        // Empty states
        no_listings: 'คุณยังไม่มีรายการ',
        no_listings_sub: 'สร้างรายการแรกเพื่อเริ่มขาย!',
        create_first: 'สร้างรายการแรก 🌱',

        // Modals
        confirm_delete: 'คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? การกระทำนี้ไม่สามารถย้อนกลับได้',
        confirm_logout: 'คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?',
        confirm_cancel_order: 'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกออเดอร์นี้?',
        btn_confirm_yes: 'ใช่ ลบเลย',
        btn_confirm_logout: 'ใช่ ออกจากระบบ',
        btn_cancel_modal: 'ยกเลิก',

        // Error states
        error_generic: 'เกิดข้อผิดพลาด',
        error_reload: 'รีเฟรชหน้า',
        retry: 'ลองอีกครั้ง',

        // CSV Export
        export_csv: 'ส่งออก CSV',
        export_listings: 'ส่งออกรายการ',
        export_orders: 'ส่งออกออเดอร์',
      }
    };

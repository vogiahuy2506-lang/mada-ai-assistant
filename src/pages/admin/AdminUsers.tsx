import React, { useEffect, useState, useCallback } from 'react';
import { AdminLayout } from './AdminLayout';
import { getAccessToken, getRefreshToken } from '../../lib/api';
import { useAuthStore, useLanguageStore } from '@/stores';
import clsx from 'clsx';
import {
  Users, Search, Shield, ShieldOff, Trash2,
  CheckCircle2, XCircle, Loader2,
  Mail, Calendar, Clock, UserPlus, Copy, Check, Eye, EyeOff, X,
  KeyRound, RefreshCw, Sparkles, AlertTriangle, ShieldCheck,
} from 'lucide-react';

// Admin Users translations - supports all languages via useLanguageStore
const tU = (key: string, params?: Record<string, string>): string => {
  const lang = useLanguageStore.getState().language ?? 'vi';
  const translations: Record<string, Record<string, string>> = {
    vi: {
      // Common
      'admin.common.loading': 'Đang tải...',
      'admin.common.error': 'Có lỗi xảy ra',
      'admin.common.active': 'Hoạt động',
      'admin.common.cancel': 'Hủy',
      'admin.common.save': 'Lưu',
      'admin.common.all': 'Tất cả',
      'admin.common.selected': 'đã chọn',
      'admin.common.selectAll': 'Chọn tất cả',
      'admin.common.deselect': 'Bỏ chọn',
      'admin.common.previous': 'Trước',
      'admin.common.next': 'Tiếp',
      'admin.common.page': 'Trang',
      'admin.common.edit': 'Sửa',
      'admin.common.add': 'Thêm',
      'admin.common.delete': 'Xóa',
      'admin.common.success': 'Thành công',
      // Users specific
      'admin.users.title': 'Quản lý Người dùng',
      'admin.users.heroTitle': 'Quản lý Người dùng',
      'admin.users.heroSubtitle': 'Quản lý tài khoản, phân quyền và theo dõi hoạt động của người dùng trong hệ thống.',
      'admin.users.totalUsers': 'Tổng người dùng',
      'admin.users.activeUsers': 'Đang hoạt động',
      'admin.users.pendingUsers': 'Chờ duyệt',
      'admin.users.lockedUsers': 'Bị khóa',
      'admin.users.searchPlaceholder': 'Tìm kiếm theo tên, email...',
      'admin.users.allStatus': 'Tất cả trạng thái',
      'admin.users.active': 'Hoạt động',
      'admin.users.pending': 'Chờ duyệt',
      'admin.users.locked': 'Bị khóa',
      'admin.users.allRoles': 'Tất cả vai trò',
      'admin.users.admin': 'Quản trị',
      'admin.users.user': 'Người dùng',
      'admin.users.staff': 'Nhân viên',
      'admin.users.superAdmin': 'Super Admin',
      'admin.users.limited': '(giới hạn)',
      'admin.users.createUser': 'Tạo người dùng',
      'admin.users.userCol': 'Người dùng',
      'admin.users.statusCol': 'Trạng thái',
      'admin.users.roleCol': 'Vai trò',
      'admin.users.planCol': 'Gói',
      'admin.users.loginCol': 'Đăng nhập cuối',
      'admin.users.createdCol': 'Tạo lúc',
      'admin.users.actionsCol': 'Hành động',
      'admin.users.noUsers': 'Chưa có người dùng nào',
      'admin.users.prev': '← Trước',
      'admin.users.next': 'Tiếp →',
      'admin.users.page': 'Trang',
      'admin.users.superAdminBadge': 'Super Admin',
      'admin.users.planFree': 'Miễn phí',
      'admin.users.planPro': 'Pro',
      'admin.users.planEnterprise': 'Enterprise',
      'admin.users.lockAccount': 'Khóa tài khoản',
      'admin.users.unlockAccount': 'Mở khóa tài khoản',
      'admin.users.approveAccount': 'Phê duyệt tài khoản',
      'admin.users.promoteToAdmin': 'Nâng cấp lên Admin',
      'admin.users.demoteToUser': 'Hạ cấp xuống User',
      'admin.users.resetPassword': 'Đặt lại mật khẩu',
      'admin.users.deleteAccount': 'Xóa tài khoản',
      'admin.users.createAccountTitle': 'Tạo tài khoản mới',
      'admin.users.fullName': 'Họ tên',
      'admin.users.namePlaceholder': 'Nhập họ tên',
      'admin.users.email': 'Email',
      'admin.users.emailPlaceholder': 'user@example.com',
      'admin.users.password': 'Mật khẩu',
      'admin.users.autoGenerate': 'Tự động tạo',
      'admin.users.autoGenPlaceholder': 'Mật khẩu sẽ được tạo tự động',
      'admin.users.enterManually': 'Nhập thủ công',
      'admin.users.generateNew': 'Tạo mới',
      'admin.users.hidePassword': 'Ẩn mật khẩu',
      'admin.users.showPassword': 'Hiện mật khẩu',
      'admin.users.autoGenDesc': 'Mật khẩu an toàn sẽ được tạo tự động',
      'admin.users.manualEntryDesc': 'Nhập mật khẩu theo ý muốn',
      'admin.users.creating': 'Đang tạo...',
      'admin.users.create': 'Tạo',
      'admin.users.accountCreatedSuccess': 'Tài khoản đã được tạo!',
      'admin.users.loginEmail': 'Email đăng nhập',
      'admin.users.tempPassword': 'Mật khẩu tạm',
      'admin.users.titleCopyEmail': 'Sao chép email',
      'admin.users.titleCopyPassword': 'Sao chép mật khẩu',
      'admin.users.passwordShownOnce': 'Mật khẩu chỉ hiển thị một lần. Hãy sao chép ngay!',
      'admin.users.copyForChat': 'Copy để gửi chat',
      'admin.users.copiedAllInfo': 'Đã copy!',
      'admin.users.chatTemplate': 'Email: {email}\nMật khẩu: {password}\nĐăng nhập tại: {url}',
      'admin.users.close': 'Đóng',
      'admin.users.resetPasswordTitle': 'Đặt lại mật khẩu',
      'admin.users.newPasswordCreated': 'Mật khẩu mới đã được tạo cho',
      'admin.users.newPassword': 'Mật khẩu mới',
      'admin.users.requestInterrupted': 'Yêu cầu bị gián đoạn. Vui lòng thử lại.',
      'admin.users.sessionExpired': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      'admin.users.error': 'Lỗi',
      'admin.users.noPermission': 'Bạn không có quyền thực hiện hành động này.',
      'admin.users.emailExists': 'Email đã tồn tại trong hệ thống.',
      'admin.users.nameRequired': 'Vui lòng nhập họ tên.',
      'admin.users.pwdMinChars': 'Mật khẩu phải có ít nhất 6 ký tự.',
      'admin.users.createFailed': 'Tạo người dùng thất bại.',
      'admin.users.connectionError': 'Lỗi kết nối. Vui lòng kiểm tra mạng.',
      'admin.users.resetFail': 'Đặt lại mật khẩu thất bại.',
      'admin.users.confirmDeleteUser': 'Xác nhận xóa người dùng {name} ({email})?',
      'admin.users.confirmDeleteAdmin': 'Đây là tài khoản Admin. Bạn có chắc muốn xóa?',
      'admin.users.confirmRoleChange': 'Xác nhận thay đổi vai trò thành {role}?',
      'admin.users.confirmResetPwd': 'Đặt lại mật khẩu cho {name} ({email})?',
      'admin.users.neverLogin': 'Chưa đăng nhập',
      'admin.users.superAdminOnly': '(Chỉ Super Admin)',
      'admin.users.plan': 'Gói',
      'admin.users.free': 'Miễn phí',
      'admin.users.freeQuota': '100 tin nhắn',
      'admin.users.pro': 'Pro',
      'admin.users.proQuota': '1000 tin nhắn',
      'admin.users.enterprise': 'Enterprise',
      'admin.users.enterpriseQuota': 'Không giới hạn',
    },
    en: {
      // Common
      'admin.common.loading': 'Loading...',
      'admin.common.error': 'An error occurred',
      'admin.common.active': 'Active',
      'admin.common.cancel': 'Cancel',
      'admin.common.save': 'Save',
      'admin.common.all': 'All',
      'admin.common.selected': 'selected',
      'admin.common.selectAll': 'Select all',
      'admin.common.deselect': 'Deselect',
      'admin.common.previous': 'Previous',
      'admin.common.next': 'Next',
      'admin.common.page': 'Page',
      'admin.common.edit': 'Edit',
      'admin.common.add': 'Add',
      'admin.common.delete': 'Delete',
      'admin.common.success': 'Success',
      // Users specific
      'admin.users.title': 'User Management',
      'admin.users.heroTitle': 'User Management',
      'admin.users.heroSubtitle': 'Manage accounts, permissions and monitor user activities in the system.',
      'admin.users.totalUsers': 'Total Users',
      'admin.users.activeUsers': 'Active',
      'admin.users.pendingUsers': 'Pending',
      'admin.users.lockedUsers': 'Locked',
      'admin.users.searchPlaceholder': 'Search by name, email...',
      'admin.users.allStatus': 'All statuses',
      'admin.users.active': 'Active',
      'admin.users.pending': 'Pending',
      'admin.users.locked': 'Locked',
      'admin.users.allRoles': 'All roles',
      'admin.users.admin': 'Admin',
      'admin.users.user': 'User',
      'admin.users.staff': 'Staff',
      'admin.users.superAdmin': 'Super Admin',
      'admin.users.limited': '(limited)',
      'admin.users.createUser': 'Create User',
      'admin.users.userCol': 'User',
      'admin.users.statusCol': 'Status',
      'admin.users.roleCol': 'Role',
      'admin.users.planCol': 'Plan',
      'admin.users.loginCol': 'Last Login',
      'admin.users.createdCol': 'Created',
      'admin.users.actionsCol': 'Actions',
      'admin.users.noUsers': 'No users yet',
      'admin.users.prev': '← Prev',
      'admin.users.next': 'Next →',
      'admin.users.page': 'Page',
      'admin.users.superAdminBadge': 'Super Admin',
      'admin.users.planFree': 'Free',
      'admin.users.planPro': 'Pro',
      'admin.users.planEnterprise': 'Enterprise',
      'admin.users.lockAccount': 'Lock Account',
      'admin.users.unlockAccount': 'Unlock Account',
      'admin.users.approveAccount': 'Approve Account',
      'admin.users.promoteToAdmin': 'Promote to Admin',
      'admin.users.demoteToUser': 'Demote to User',
      'admin.users.resetPassword': 'Reset Password',
      'admin.users.deleteAccount': 'Delete Account',
      'admin.users.createAccountTitle': 'Create New Account',
      'admin.users.fullName': 'Full Name',
      'admin.users.namePlaceholder': 'Enter full name',
      'admin.users.email': 'Email',
      'admin.users.emailPlaceholder': 'user@example.com',
      'admin.users.password': 'Password',
      'admin.users.autoGenerate': 'Auto generate',
      'admin.users.autoGenPlaceholder': 'Password will be auto-generated',
      'admin.users.enterManually': 'Enter manually',
      'admin.users.generateNew': 'Generate New',
      'admin.users.hidePassword': 'Hide password',
      'admin.users.showPassword': 'Show password',
      'admin.users.autoGenDesc': 'A secure password will be auto-generated',
      'admin.users.manualEntryDesc': 'Enter password as you wish',
      'admin.users.creating': 'Creating...',
      'admin.users.create': 'Create',
      'admin.users.accountCreatedSuccess': 'Account created!',
      'admin.users.loginEmail': 'Login Email',
      'admin.users.tempPassword': 'Temporary Password',
      'admin.users.titleCopyEmail': 'Copy email',
      'admin.users.titleCopyPassword': 'Copy password',
      'admin.users.passwordShownOnce': 'Password is shown only once. Copy now!',
      'admin.users.copyForChat': 'Copy to send chat',
      'admin.users.copiedAllInfo': 'Copied!',
      'admin.users.chatTemplate': 'Email: {email}\nPassword: {password}\nLogin at: {url}',
      'admin.users.close': 'Close',
      'admin.users.resetPasswordTitle': 'Reset Password',
      'admin.users.newPasswordCreated': 'New password created for',
      'admin.users.newPassword': 'New Password',
      'admin.users.requestInterrupted': 'Request interrupted. Please try again.',
      'admin.users.sessionExpired': 'Session expired. Please login again.',
      'admin.users.error': 'Error',
      'admin.users.noPermission': 'You do not have permission to perform this action.',
      'admin.users.emailExists': 'Email already exists in the system.',
      'admin.users.nameRequired': 'Please enter full name.',
      'admin.users.pwdMinChars': 'Password must be at least 6 characters.',
      'admin.users.createFailed': 'Failed to create user.',
      'admin.users.connectionError': 'Connection error. Please check your network.',
      'admin.users.resetFail': 'Failed to reset password.',
      'admin.users.confirmDeleteUser': 'Confirm delete user {name} ({email})?',
      'admin.users.confirmDeleteAdmin': 'This is an Admin account. Are you sure you want to delete?',
      'admin.users.confirmRoleChange': 'Confirm change role to {role}?',
      'admin.users.confirmResetPwd': 'Reset password for {name} ({email})?',
      'admin.users.neverLogin': 'Never logged in',
      'admin.users.superAdminOnly': '(Super Admin only)',
      'admin.users.plan': 'Plan',
      'admin.users.free': 'Free',
      'admin.users.freeQuota': '100 messages',
      'admin.users.pro': 'Pro',
      'admin.users.proQuota': '1000 messages',
      'admin.users.enterprise': 'Enterprise',
      'admin.users.enterpriseQuota': 'Unlimited',
    },
    ar: {
      // Common
      'admin.common.loading': 'جاري التحميل...',
      'admin.common.error': 'حدث خطأ',
      'admin.common.active': 'نشط',
      'admin.common.cancel': 'إلغاء',
      'admin.common.save': 'حفظ',
      'admin.common.all': 'الكل',
      'admin.common.selected': 'محدد',
      'admin.common.selectAll': 'تحديد الكل',
      'admin.common.deselect': 'إلغاء التحديد',
      'admin.common.previous': 'السابق',
      'admin.common.next': 'التالي',
      'admin.common.page': 'صفحة',
      'admin.common.edit': 'تعديل',
      'admin.common.add': 'إضافة',
      'admin.common.delete': 'حذف',
      'admin.common.success': 'نجاح',
      // Users specific
      'admin.users.title': 'إدارة المستخدمين',
      'admin.users.heroTitle': 'إدارة المستخدمين',
      'admin.users.heroSubtitle': 'إدارة الحسابات والأذونات ومراقبة أنشطة المستخدمين في النظام.',
      'admin.users.totalUsers': 'إجمالي المستخدمين',
      'admin.users.activeUsers': 'نشط',
      'admin.users.pendingUsers': 'معلق',
      'admin.users.lockedUsers': 'مقفل',
      'admin.users.searchPlaceholder': 'البحث بالاسم أو البريد...',
      'admin.users.allStatus': 'جميع الحالات',
      'admin.users.active': 'نشط',
      'admin.users.pending': 'معلق',
      'admin.users.locked': 'مقفل',
      'admin.users.allRoles': 'جميع الأدوار',
      'admin.users.admin': 'مدير',
      'admin.users.user': 'مستخدم',
      'admin.users.staff': 'موظف',
      'admin.users.superAdmin': 'مدير أعلى',
      'admin.users.limited': '(محدد)',
      'admin.users.createUser': 'إنشاء مستخدم',
      'admin.users.userCol': 'مستخدم',
      'admin.users.statusCol': 'حالة',
      'admin.users.roleCol': 'دور',
      'admin.users.planCol': 'خطة',
      'admin.users.loginCol': 'آخر تسجيل دخول',
      'admin.users.createdCol': 'تاريخ الإنشاء',
      'admin.users.actionsCol': 'إجراءات',
      'admin.users.noUsers': 'لا يوجد مستخدمون بعد',
      'admin.users.prev': '→ السابق',
      'admin.users.next': 'التالي ←',
      'admin.users.page': 'صفحة',
      'admin.users.superAdminBadge': 'مدير أعلى',
      'admin.users.planFree': 'مجاني',
      'admin.users.planPro': 'احترافي',
      'admin.users.planEnterprise': 'مؤسساتي',
      'admin.users.lockAccount': 'قفل الحساب',
      'admin.users.unlockAccount': 'فتح الحساب',
      'admin.users.approveAccount': 'الموافقة على الحساب',
      'admin.users.promoteToAdmin': 'ترقية إلى مدير',
      'admin.users.demoteToUser': 'تخفيض إلى مستخدم',
      'admin.users.resetPassword': 'إعادة تعيين كلمة المرور',
      'admin.users.deleteAccount': 'حذف الحساب',
      'admin.users.createAccountTitle': 'إنشاء حساب جديد',
      'admin.users.fullName': 'الاسم الكامل',
      'admin.users.namePlaceholder': 'أدخل الاسم الكامل',
      'admin.users.email': 'البريد الإلكتروني',
      'admin.users.emailPlaceholder': 'user@example.com',
      'admin.users.password': 'كلمة المرور',
      'admin.users.autoGenerate': 'توليد تلقائي',
      'admin.users.autoGenPlaceholder': 'سيتم توليد كلمة المرور تلقائياً',
      'admin.users.enterManually': 'إدخال يدوي',
      'admin.users.generateNew': 'توليد جديد',
      'admin.users.hidePassword': 'إخفاء كلمة المرور',
      'admin.users.showPassword': 'إظهار كلمة المرور',
      'admin.users.autoGenDesc': 'سيتم توليد كلمة مرور آمنة تلقائياً',
      'admin.users.manualEntryDesc': 'أدخل كلمة المرور حسب رغبتك',
      'admin.users.creating': 'جاري الإنشاء...',
      'admin.users.create': 'إنشاء',
      'admin.users.accountCreatedSuccess': 'تم إنشاء الحساب!',
      'admin.users.loginEmail': 'بريد تسجيل الدخول',
      'admin.users.tempPassword': 'كلمة المرور المؤقتة',
      'admin.users.titleCopyEmail': 'نسخ البريد',
      'admin.users.titleCopyPassword': 'نسخ كلمة المرور',
      'admin.users.passwordShownOnce': 'كلمة المرور تظهر مرة واحدة فقط. انسخها الآن!',
      'admin.users.copyForChat': 'نسخ للإرسال',
      'admin.users.copiedAllInfo': 'تم النسخ!',
      'admin.users.chatTemplate': 'البريد: {email}\nكلمة المرور: {password}\nتسجيل الدخول في: {url}',
      'admin.users.close': 'إغلاق',
      'admin.users.resetPasswordTitle': 'إعادة تعيين كلمة المرور',
      'admin.users.newPasswordCreated': 'تم إنشاء كلمة مرور جديدة لـ',
      'admin.users.newPassword': 'كلمة المرور الجديدة',
      'admin.users.requestInterrupted': 'تم مقاطعة الطلب. يرجى المحاولة مرة أخرى.',
      'admin.users.sessionExpired': 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.',
      'admin.users.error': 'خطأ',
      'admin.users.noPermission': 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
      'admin.users.emailExists': 'البريد الإلكتروني موجود بالفعل في النظام.',
      'admin.users.nameRequired': 'يرجى إدخال الاسم الكامل.',
      'admin.users.pwdMinChars': 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.',
      'admin.users.createFailed': 'فشل في إنشاء المستخدم.',
      'admin.users.connectionError': 'خطأ في الاتصال. يرجى التحقق من الشبكة.',
      'admin.users.resetFail': 'فشل في إعادة تعيين كلمة المرور.',
      'admin.users.confirmDeleteUser': 'تأكيد حذف المستخدم {name} ({email})؟',
      'admin.users.confirmDeleteAdmin': 'هذا حساب مدير. هل أنت متأكد من الحذف؟',
      'admin.users.confirmRoleChange': 'تأكيد تغيير الدور إلى {role}؟',
      'admin.users.confirmResetPwd': 'إعادة تعيين كلمة المرور لـ {name} ({email})؟',
      'admin.users.neverLogin': 'لم يسجل الدخول أبداً',
      'admin.users.superAdminOnly': '(المدير الأعلى فقط)',
      'admin.users.plan': 'خطة',
      'admin.users.free': 'مجاني',
      'admin.users.freeQuota': '100 رسالة',
      'admin.users.pro': 'احترافي',
      'admin.users.proQuota': '1000 رسالة',
      'admin.users.enterprise': 'مؤسساتي',
      'admin.users.enterpriseQuota': 'غير محدود',
    },
    fr: {
      // Common
      'admin.common.loading': 'Chargement...',
      'admin.common.error': 'Une erreur est survenue',
      'admin.common.active': 'Actif',
      'admin.common.cancel': 'Annuler',
      'admin.common.save': 'Enregistrer',
      'admin.common.all': 'Tous',
      'admin.common.selected': 'sélectionné',
      'admin.common.selectAll': 'Tout sélectionner',
      'admin.common.deselect': 'Tout désélectionner',
      'admin.common.previous': 'Précédent',
      'admin.common.next': 'Suivant',
      'admin.common.page': 'Page',
      'admin.common.edit': 'Modifier',
      'admin.common.add': 'Ajouter',
      'admin.common.delete': 'Supprimer',
      'admin.common.success': 'Succès',
      // Users specific
      'admin.users.title': 'Gestion des utilisateurs',
      'admin.users.heroTitle': 'Gestion des utilisateurs',
      'admin.users.heroSubtitle': 'Gérer les comptes, les permissions et surveiller les activités des utilisateurs.',
      'admin.users.totalUsers': 'Total utilisateurs',
      'admin.users.activeUsers': 'Actifs',
      'admin.users.pendingUsers': 'En attente',
      'admin.users.lockedUsers': 'Verrouillés',
      'admin.users.searchPlaceholder': 'Rechercher par nom, email...',
      'admin.users.allStatus': 'Tous les statuts',
      'admin.users.active': 'Actif',
      'admin.users.pending': 'En attente',
      'admin.users.locked': 'Verrouillé',
      'admin.users.allRoles': 'Tous les rôles',
      'admin.users.admin': 'Admin',
      'admin.users.user': 'Utilisateur',
      'admin.users.staff': 'Personnel',
      'admin.users.superAdmin': 'Super Admin',
      'admin.users.limited': '(limité)',
      'admin.users.createUser': 'Créer un utilisateur',
      'admin.users.userCol': 'Utilisateur',
      'admin.users.statusCol': 'Statut',
      'admin.users.roleCol': 'Rôle',
      'admin.users.planCol': 'Plan',
      'admin.users.loginCol': 'Dernière connexion',
      'admin.users.createdCol': 'Créé le',
      'admin.users.actionsCol': 'Actions',
      'admin.users.noUsers': 'Pas encore d\'utilisateurs',
      'admin.users.prev': '← Préc',
      'admin.users.next': 'Suiv →',
      'admin.users.page': 'Page',
      'admin.users.superAdminBadge': 'Super Admin',
      'admin.users.planFree': 'Gratuit',
      'admin.users.planPro': 'Pro',
      'admin.users.planEnterprise': 'Entreprise',
      'admin.users.lockAccount': 'Verrouiller le compte',
      'admin.users.unlockAccount': 'Déverrouiller le compte',
      'admin.users.approveAccount': 'Approuver le compte',
      'admin.users.promoteToAdmin': 'Promouvoir Admin',
      'admin.users.demoteToUser': 'Rétrograder Utilisateur',
      'admin.users.resetPassword': 'Réinitialiser le mot de passe',
      'admin.users.deleteAccount': 'Supprimer le compte',
      'admin.users.createAccountTitle': 'Créer un nouveau compte',
      'admin.users.fullName': 'Nom complet',
      'admin.users.namePlaceholder': 'Entrez le nom complet',
      'admin.users.email': 'Email',
      'admin.users.emailPlaceholder': 'user@example.com',
      'admin.users.password': 'Mot de passe',
      'admin.users.autoGenerate': 'Génération auto',
      'admin.users.autoGenPlaceholder': 'Le mot de passe sera généré automatiquement',
      'admin.users.enterManually': 'Saisie manuelle',
      'admin.users.generateNew': 'Générer nouveau',
      'admin.users.hidePassword': 'Masquer le mot de passe',
      'admin.users.showPassword': 'Afficher le mot de passe',
      'admin.users.autoGenDesc': 'Un mot de passe sécurisé sera généré automatiquement',
      'admin.users.manualEntryDesc': 'Entrez le mot de passe à votre guise',
      'admin.users.creating': 'Création...',
      'admin.users.create': 'Créer',
      'admin.users.accountCreatedSuccess': 'Compte créé!',
      'admin.users.loginEmail': 'Email de connexion',
      'admin.users.tempPassword': 'Mot de passe temporaire',
      'admin.users.titleCopyEmail': 'Copier l\'email',
      'admin.users.titleCopyPassword': 'Copier le mot de passe',
      'admin.users.passwordShownOnce': 'Le mot de passe n\'est affiché qu\'une fois. Copiez-le maintenant!',
      'admin.users.copyForChat': 'Copier pour envoyer',
      'admin.users.copiedAllInfo': 'Copié!',
      'admin.users.chatTemplate': 'Email: {email}\nMot de passe: {password}\nConnexion sur: {url}',
      'admin.users.close': 'Fermer',
      'admin.users.resetPasswordTitle': 'Réinitialiser le mot de passe',
      'admin.users.newPasswordCreated': 'Nouveau mot de passe créé pour',
      'admin.users.newPassword': 'Nouveau mot de passe',
      'admin.users.requestInterrupted': 'Demande interrompue. Veuillez réessayer.',
      'admin.users.sessionExpired': 'Session expirée. Veuillez vous reconnecter.',
      'admin.users.error': 'Erreur',
      'admin.users.noPermission': 'Vous n\'avez pas la permission d\'effectuer cette action.',
      'admin.users.emailExists': 'L\'email existe déjà dans le système.',
      'admin.users.nameRequired': 'Veuillez entrer le nom complet.',
      'admin.users.pwdMinChars': 'Le mot de passe doit contenir au moins 6 caractères.',
      'admin.users.createFailed': 'Échec de la création de l\'utilisateur.',
      'admin.users.connectionError': 'Erreur de connexion. Veuillez vérifier votre réseau.',
      'admin.users.resetFail': 'Échec de la réinitialisation du mot de passe.',
      'admin.users.confirmDeleteUser': 'Confirmer la suppression de {name} ({email})?',
      'admin.users.confirmDeleteAdmin': 'Ceci est un compte Admin. Êtes-vous sûr de vouloir supprimer?',
      'admin.users.confirmRoleChange': 'Confirmer le changement de rôle en {role}?',
      'admin.users.confirmResetPwd': 'Réinitialiser le mot de passe pour {name} ({email})?',
      'admin.users.neverLogin': 'Jamais connecté',
      'admin.users.superAdminOnly': '(Super Admin uniquement)',
      'admin.users.plan': 'Plan',
      'admin.users.free': 'Gratuit',
      'admin.users.freeQuota': '100 messages',
      'admin.users.pro': 'Pro',
      'admin.users.proQuota': '1000 messages',
      'admin.users.enterprise': 'Entreprise',
      'admin.users.enterpriseQuota': 'Illimité',
    },
  };
  
  let text = translations[lang]?.[key] || translations['vi'][key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
  }
  return text;
};

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin' | 'user';
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'pending' | 'suspended';
  provider: 'email' | 'google';
  quota_used: number;
  quota_limit: number;
  created_at: string;
  last_login_at: string | null;
}

type FilterStatus = 'all' | 'active' | 'pending' | 'suspended';
type FilterRole = 'all' | 'admin' | 'super_admin' | 'user';

interface CreatedUserResult {
  user: { id: string; email: string; name: string; role: string; plan: string };
  tempPassword: string;
  message: string;
}

// Translation helper for Admin Users
function useAdminUsersTranslation() {
  // Format date
  const formatDate = (date: string | null): string => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return {
    t: tU,
    formatDate,
  };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [totalUsers, setTotalUsers] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Check if current user is Super Admin
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const { t, formatDate } = useAdminUsersTranslation();

  // ─── Auth helper with auto-refresh + friendly error ───
  const adminFetch = useCallback(async (path: string, init: RequestInit = {}, retry = true): Promise<any> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> || {}),
    };
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res: Response;
    try {
      res = await fetch(`/api${path}`, { ...init, headers });
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message === 'Failed to fetch' || err instanceof TypeError) {
        throw new Error(tU('admin.users.requestInterrupted'));
      }
      throw err;
    }

    if (res.status === 401 && retry && getRefreshToken()) {
      let refreshRes: Response;
      try {
        refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: getRefreshToken() }),
        });
      } catch (err: any) {
        localStorage.removeItem('mada-access-token');
        localStorage.removeItem('mada-refresh-token');
        throw new Error(tU('admin.users.sessionExpired'));
      }
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        if (data.success) {
          localStorage.setItem('mada-access-token', data.data.accessToken);
          localStorage.setItem('mada-refresh-token', data.data.refreshToken);
          return adminFetch(path, init, false);
        }
      }
      // Refresh failed → logout
      localStorage.removeItem('mada-access-token');
      localStorage.removeItem('mada-refresh-token');
      throw new Error(tU('admin.users.sessionExpired'));
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Make Vietnamese error messages friendly
      let msg = data.error || `${tU('admin.users.error')} ${res.status}`;
      if (res.status === 401) msg = tU('admin.users.sessionExpired');
      if (res.status === 403) msg = tU('admin.users.noPermission');
      if (res.status === 409) msg = data.error || tU('admin.users.emailExists');
      throw new Error(msg);
    }
    return data;
  }, [t]);

  // ─── Create user modal ───
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'user' | 'admin',
    plan: 'free' as 'free' | 'pro' | 'enterprise',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [autoGenPassword, setAutoGenPassword] = useState(true);

  // ─── After-create result modal ───
  const [createdResult, setCreatedResult] = useState<CreatedUserResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // ─── Reset password modal ───
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch('/admin/users');
      if (data.success) {
        let items = data.data || [];

        if (search) {
          const q = search.toLowerCase();
          items = items.filter((u: User) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q)
          );
        }
        if (filterStatus !== 'all') items = items.filter((u: User) => u.status === filterStatus);
        if (filterRole !== 'all') items = items.filter((u: User) => u.role === filterRole);

        setTotalUsers(items.length);
        setUsers(items.slice(page * pageSize, (page + 1) * pageSize));
      }
    } catch (e) {
      console.error('Load users error:', e);
    } finally { setLoading(false); }
  }, [search, filterStatus, filterRole, page, adminFetch]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { setPage(0); }, [search, filterStatus, filterRole]);

  const handleUpdateStatus = async (userId: string, status: 'active' | 'suspended') => {
    setActionLoading(userId);
    try {
      await adminFetch(`/admin/users/${userId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await loadUsers();
    } catch (e: any) {
      alert(e.message || tU('admin.common.error'));
    } finally { setActionLoading(null); }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(tU('admin.users.confirmDeleteUser', { name: user.name, email: user.email }))) return;
    if (user.role === 'admin' && !confirm(tU('admin.users.confirmDeleteAdmin'))) return;

    setActionLoading(user.id);
    try {
      await adminFetch(`/admin/users/${user.id}`, { method: 'DELETE' });
      await loadUsers();
    } catch (e: any) {
      alert(e.message || tU('admin.common.error'));
    } finally { setActionLoading(null); }
  };

  const handleUpdateRole = async (userId: string, role: 'admin' | 'user') => {
    if (!confirm(tU('admin.users.confirmRoleChange', { role }))) return;
    setActionLoading(userId);
    try {
      await adminFetch(`/admin/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      await loadUsers();
    } catch (e: any) {
      alert(e.message || tU('admin.common.error'));
    } finally { setActionLoading(null); }
  };

  // ─── Generate password client-side for preview ───
  const generatePassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digit = '23456789';
    const all = upper + lower + digit;
    let pwd =
      upper.charAt(Math.floor(Math.random() * upper.length)) +
      lower.charAt(Math.floor(Math.random() * lower.length)) +
      digit.charAt(Math.floor(Math.random() * digit.length));
    for (let i = 0; i < 9; i++) {
      pwd += all.charAt(Math.floor(Math.random() * all.length));
    }
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
  };

  // ─── Create user ───
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!createForm.name.trim() || !createForm.email.trim()) {
      setCreateError(tU('admin.users.nameRequired'));
      return;
    }
    if (!autoGenPassword && createForm.password.length < 6) {
      setCreateError(tU('admin.users.pwdMinChars'));
      return;
    }

    setCreateLoading(true);
    try {
      const payload: any = {
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        role: createForm.role,
        plan: createForm.plan,
      };
      if (!autoGenPassword) payload.password = createForm.password;

      const data = await adminFetch('/admin/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.success) {
        setCreatedResult({
          user: data.data,
          tempPassword: data.data.tempPassword,
          message: data.data.message,
        });
        // Reset form + close create modal
        setShowCreateModal(false);
        setCreateForm({ name: '', email: '', password: '', role: 'user', plan: 'free' });
        setAutoGenPassword(true);
        await loadUsers();
      } else {
        setCreateError(data.error || tU('admin.users.createFailed'));
      }
    } catch (err: any) {
      setCreateError(err.message || tU('admin.users.connectionError'));
    } finally {
      setCreateLoading(false);
    }
  };

  // ─── Reset password ───
  const handleResetPassword = async (user: User) => {
    if (!confirm(tU('admin.users.confirmResetPwd', { name: user.name, email: user.email }))) return;
    setResetTarget(user);
    setResetResult(null);
    setResetLoading(true);
    try {
      const data = await adminFetch(`/admin/users/${user.id}/reset-password`, { method: 'POST' });
      if (data.success) {
        setResetResult({ email: data.data.email, tempPassword: data.data.tempPassword });
      } else {
        alert(data.error || tU('admin.users.resetFail'));
        setResetTarget(null);
      }
    } catch (err: any) {
      alert(err.message || tU('admin.users.connectionError'));
      setResetTarget(null);
    } finally {
      setResetLoading(false);
    }
  };

  // ─── Copy to clipboard helper ───
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  const getStatusBadge = (status: User['status']) => {
    const styles = {
      active: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      pending: 'bg-amber-100 text-amber-700 border-amber-300',
      suspended: 'bg-red-100 text-red-700 border-red-300',
    };
    const labelKeys = {
      active: tU('admin.users.activeUsers'),
      pending: tU('admin.users.pending'),
      suspended: tU('admin.users.locked'),
    };
    return (
      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0', styles[status])}>
        {labelKeys[status]}
      </span>
    );
  };

  const getRoleBadge = (role: User['role']) => (
    <span className={clsx(
      'px-2 py-0.5 rounded-full text-[10px] font-black border border-slate-300 whitespace-nowrap shrink-0',
      role === 'super_admin'
        ? 'bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white'
        : role === 'admin'
        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
        : 'bg-slate-100 text-slate-600'
    )}>
      {role === 'super_admin' ? tU('admin.users.superAdminBadge') : role === 'admin' ? `👑 ${tU('admin.users.admin')}` : `👤 ${tU('admin.users.staff')}`}
    </span>
  );

  const getPlanBadge = (plan: User['plan']) => {
    const styles = {
      free: 'bg-slate-100 text-slate-600',
      pro: 'bg-blue-100 text-blue-700',
      enterprise: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white',
    };
    const planLabels = {
      free: tU('admin.users.planFree'),
      pro: tU('admin.users.planPro'),
      enterprise: tU('admin.users.planEnterprise'),
    };
    return (
      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0', styles[plan])}>
        {planLabels[plan]}
      </span>
    );
  };

  return (
    <AdminLayout
      titleKey="admin.topBar.users"
      subtitleKey="admin.topBar.usersSub"
      showFab={false}
      showLayoutTitle={false}
    >
      {/* Hero Banner Section */}
      <section className="mb-8">
        <div className="flex justify-between items-end mb-6 relative gap-4 flex-wrap">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-white to-secondary/10 backdrop-blur-xl rounded-3xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent rounded-3xl"></div>
          <div className="max-w-2xl relative z-10 py-6 px-6">
            <h2 className="text-3xl md:text-4xl font-black text-on-surface mb-2 tracking-tight">
              {tU('admin.users.heroTitle')}
            </h2>
            <p className="text-sm md:text-base font-medium text-on-surface-variant border-l-4 border-primary pl-4 py-1 bg-white/40 backdrop-blur-sm rounded-r-xl"
               dangerouslySetInnerHTML={{ __html: tU('admin.users.heroSubtitle') }}
            />
          </div>
          {/* Role Badge + Create User Button */}
          <div className="relative z-10 py-6 px-6 flex items-center gap-3">
            {/* Role Badge */}
            {isSuperAdmin ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow">
                <ShieldCheck className="w-4 h-4" />
                <span className="font-bold text-sm">{tU('admin.users.superAdmin')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary">
                <Shield className="w-4 h-4" />
                <span className="font-bold text-sm">{tU('admin.users.admin')}</span>
                <span className="text-xs opacity-70">{tU('admin.users.limited')}</span>
              </div>
            )}
            <button
              onClick={() => {
                setCreateError('');
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white font-bold text-sm border border-slate-200 shadow-sm hover:shadow-[5px_5px_0px_0px_#000] hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all"
            >
              <UserPlus className="w-4 h-4" />
              {tU('admin.users.createUser')}
            </button>
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label={tU('admin.users.totalUsers')} value={totalUsers} icon={<Users className="w-5 h-5" />} color="bg-indigo-500" />
        <StatCard
          label={tU('admin.users.activeUsers')}
          value={users.filter(u => u.status === 'active').length}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="bg-emerald-500"
        />
        <StatCard
          label={tU('admin.users.pendingUsers')}
          value={users.filter(u => u.status === 'pending').length}
          icon={<Clock className="w-5 h-5" />}
          color="bg-amber-500"
        />
        <StatCard
          label={tU('admin.users.lockedUsers')}
          value={users.filter(u => u.status === 'suspended').length}
          icon={<XCircle className="w-5 h-5" />}
          color="bg-red-500"
        />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-300 p-4 mb-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={tU('admin.users.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-3 py-2 rounded-lg border border-slate-300 font-medium text-sm bg-white"
          >
            <option value="all">{tU('admin.users.allStatus')}</option>
            <option value="active">{tU('admin.users.active')}</option>
            <option value="pending">{tU('admin.users.pending')}</option>
            <option value="suspended">{tU('admin.users.locked')}</option>
          </select>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as FilterRole)}
            className="px-3 py-2 rounded-lg border border-slate-300 font-medium text-sm bg-white"
          >
            <option value="all">{tU('admin.users.allRoles')}</option>
            <option value="admin">{tU('admin.users.admin')}</option>
            <option value="user">{tU('admin.users.user')}</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-300">
          <Users className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 font-medium">{tU('admin.users.noUsers')}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{tU('admin.users.userCol')}</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{tU('admin.users.statusCol')}</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{tU('admin.users.roleCol')}</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{tU('admin.users.planCol')}</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{tU('admin.users.loginCol')}</th>
                    <th className="text-left px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{tU('admin.users.createdCol')}</th>
                    <th className="text-right px-4 py-3 font-black text-xs uppercase tracking-wider text-slate-600">{tU('admin.users.actionsCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-black">{user.name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(user.status)}</td>
                      <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                      <td className="px-4 py-3">{getPlanBadge(user.plan)}</td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(user.last_login_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(user.created_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {user.status === 'active' ? (
                            <button
                              onClick={() => handleUpdateStatus(user.id, 'suspended')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 transition-all border border-slate-300 disabled:opacity-50"
                              title={tU('admin.users.lockAccount')}
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateStatus(user.id, 'active')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all border border-slate-300 disabled:opacity-50"
                              title={user.status === 'suspended' ? tU('admin.users.unlockAccount') : tU('admin.users.approveAccount')}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          )}

                          {user.role === 'user' ? (
                            <button
                              onClick={() => handleUpdateRole(user.id, 'admin')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-all border border-slate-300 disabled:opacity-50"
                              title={tU('admin.users.promoteToAdmin')}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUpdateRole(user.id, 'user')}
                              disabled={actionLoading === user.id}
                              className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all border border-slate-300 disabled:opacity-50"
                              title={tU('admin.users.demoteToUser')}
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          )}

                          {/* Reset password */}
                          <button
                            onClick={() => handleResetPassword(user)}
                            disabled={actionLoading === user.id}
                            className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all border border-slate-300 disabled:opacity-50"
                            title={tU('admin.users.resetPassword')}
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(user)}
                            disabled={actionLoading === user.id}
                            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all border border-slate-300 disabled:opacity-50"
                            title={tU('admin.users.deleteAccount')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-black font-bold shadow-sm hover:shadow-sm hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all disabled:opacity-30 disabled:shadow-none"
              >
                ← {tU('admin.users.prev')}
              </button>
              <span className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-black font-bold">
                {tU('admin.users.page')} {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-black font-bold shadow-sm hover:shadow-sm hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all disabled:opacity-30 disabled:shadow-none"
              >
                {tU('admin.users.next')} →
              </button>
            </div>
          )}
        </>
      )}

      {/* ═══════════════ MODAL: Tạo nhân viên ═══════════════ */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
        >
          <div className="bg-white rounded-2xl border border-slate-300 shadow-[6px_6px_0px_0px_#000] max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-violet-500 to-blue-500 text-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-black text-lg">{tU('admin.users.createAccountTitle')}</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  {tU('admin.users.fullName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder={tU('admin.users.namePlaceholder')}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  {tU('admin.users.email')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder={tU('admin.users.emailPlaceholder')}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Role + Plan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Role {!isSuperAdmin && <span className="text-amber-500 text-[10px]">{tU('admin.users.superAdminOnly')}</span>}
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-medium text-sm bg-white"
                  >
                    <option value="user">👤 {tU('admin.users.staff')}</option>
                    {isSuperAdmin && (
                      <>
                        <option value="admin">👑 {tU('admin.users.admin')}</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    {tU('admin.users.plan')}
                  </label>
                  <select
                    value={createForm.plan}
                    onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value as any })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-medium text-sm bg-white"
                  >
                    <option value="free">� {tU('admin.users.free')} ({tU('admin.users.freeQuota')})</option>
                    <option value="pro">⭐ {tU('admin.users.pro')} ({tU('admin.users.proQuota')})</option>
                    <option value="enterprise">🏢 {tU('admin.users.enterprise')} ({tU('admin.users.enterpriseQuota')})</option>
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    {tU('admin.users.password')}
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoGenPassword}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAutoGenPassword(checked);
                        // Khi bật auto-gen: tự sinh MK. Khi tắt: clear để user tự nhập.
                        setCreateForm({
                          ...createForm,
                          password: checked ? generatePassword() : '',
                        });
                        setShowCreatePassword(false);
                      }}
                      className="w-3.5 h-3.5 accent-violet-500"
                    />
                    <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">
                      {tU('admin.users.autoGenerate')}
                    </span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={autoGenPassword ? createForm.password : createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder={
                      autoGenPassword
                        ? tU('admin.users.autoGenPlaceholder')
                        : tU('admin.users.enterManually')
                    }
                    disabled={autoGenPassword}
                    className="w-full px-4 py-2.5 pr-20 rounded-lg border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-700"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(!showCreatePassword)}
                      className="p-1.5 rounded hover:bg-slate-100"
                      tabIndex={-1}
                      title={showCreatePassword ? tU('admin.users.hidePassword') : tU('admin.users.showPassword')}
                    >
                      {showCreatePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {autoGenPassword && (
                      <button
                        type="button"
                        onClick={() => setCreateForm({ ...createForm, password: generatePassword() })}
                        className="p-1.5 rounded hover:bg-slate-100"
                        tabIndex={-1}
                        title={tU('admin.users.generateNew')}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {autoGenPassword ? (
                  <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    {tU('admin.users.autoGenDesc')}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[11px] text-blue-600 flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    {tU('admin.users.manualEntryDesc')}
                  </p>
                )}
              </div>

              {createError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border-2 border-red-300">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 font-medium">{createError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-300 bg-white text-black font-bold text-sm hover:bg-slate-50"
                >
                  {tU('admin.users.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 text-white font-bold text-sm border border-slate-200 shadow-sm hover:shadow-sm hover:-translate-x-[1px] hover:-translate-y-[1px] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {tU('admin.users.creating')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      {tU('admin.users.create')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: Sau khi tạo thành công - show password ═══════════════ */}
      {createdResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-[6px_6px_0px_0px_#000] max-w-md w-full">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-black text-lg">{tU('admin.users.accountCreatedSuccess')}</h3>
              </div>
              <button
                onClick={() => setCreatedResult(null)}
                className="p-1 rounded hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-200">
                <p className="text-sm text-emerald-800 font-medium">
                  {createdResult.message}
                </p>
              </div>

              {/* Email + Password blocks */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  {tU('admin.users.loginEmail')}
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 bg-slate-50 font-mono text-sm font-bold">
                    {createdResult.user.email}
                  </div>
                  <button
                    onClick={() => copyToClipboard(createdResult.user.email, 'email')}
                    className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                    title={tU('admin.users.titleCopyEmail')}
                  >
                    {copiedField === 'email' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                  {tU('admin.users.tempPassword')}
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 bg-amber-50 font-mono text-sm font-bold text-amber-900">
                    {createdResult.tempPassword}
                  </div>
                  <button
                    onClick={() => copyToClipboard(createdResult.tempPassword, 'password')}
                    className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                    title={tU('admin.users.titleCopyPassword')}
                  >
                    {copiedField === 'password' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-amber-700 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {tU('admin.users.passwordShownOnce')}
                </p>
              </div>

              {/* Combined copy for chat apps */}
              <button
                onClick={() =>
                  copyToClipboard(
                    tU('admin.users.chatTemplate', { email: createdResult.user.email, password: createdResult.tempPassword, url: window.location.origin }),
                    'all'
                  )
                }
                className="w-full py-2.5 rounded-lg border border-slate-300 bg-violet-50 hover:bg-violet-100 text-sm font-bold flex items-center justify-center gap-2"
              >
                {copiedField === 'all' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    {tU('admin.users.copiedAllInfo')}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    {tU('admin.users.copyForChat')}
                  </>
                )}
              </button>

              <button
                onClick={() => setCreatedResult(null)}
                className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-bold text-sm hover:bg-slate-700"
              >
                {tU('admin.users.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: Reset password ═══════════════ */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-[6px_6px_0px_0px_#000] max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                <h3 className="font-black text-lg">{tU('admin.users.resetPasswordTitle')}</h3>
              </div>
              <button
                onClick={() => { setResetTarget(null); setResetResult(null); }}
                className="p-1 rounded hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {resetLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : resetResult ? (
                <>
                  <div className="p-4 rounded-xl bg-blue-50 border-2 border-blue-200">
                    <p className="text-sm text-blue-800 font-medium">
                      {tU('admin.users.newPasswordCreated')} <b>{resetResult.email}</b>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                      {tU('admin.users.newPassword')}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 bg-amber-50 font-mono text-sm font-bold text-amber-900">
                        {resetResult.tempPassword}
                      </div>
                      <button
                        onClick={() => copyToClipboard(resetResult.tempPassword, 'resetPassword')}
                        className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                      >
                        {copiedField === 'resetPassword' ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => { setResetTarget(null); setResetResult(null); }}
                    className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-bold text-sm"
                  >
                    {tU('admin.users.close')}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-300 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-black text-black">{value}</p>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}
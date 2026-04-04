export const SUPER_ADMIN_EMAILS = [
  'tikacntyas@gmail.com',
  'secrettrader011200@gmail.com',
  'svrnstcourse@gmail.com',
  'bowow0012@gmail.com'
];

export const isSuperAdmin = (email: string | null | undefined) => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
};

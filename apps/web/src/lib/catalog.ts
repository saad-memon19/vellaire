/** Mirrors apps/api/src/common/catalog.ts — keep the ids in step. */

export const LAYOUTS = [
  { id: 'classic', name: 'Classic', desc: 'Centred name, serif display, fine linework' },
  { id: 'modern', name: 'Modern', desc: 'Photo first, bold name, clean sans' },
  { id: 'minimal', name: 'Minimal', desc: 'Name, title and logo. Nothing else' },
  { id: 'executive', name: 'Executive', desc: 'Dark and quiet, made for metal cards' },
  { id: 'arabic', name: 'Classic — Arabic', desc: 'Right-to-left, Arabic name first' },
] as const;

export const THEMES = [
  { id: 'obsidian_gold', name: 'Obsidian & Gold', bg: '#141417', bg2: '#26262C', fg: '#F6F1E7', accent: '#C9A96E', muted: '#A9A49A', dark: true },
  { id: 'ivory_ink', name: 'Ivory & Ink', bg: '#FBF7EF', bg2: '#FBF7EF', fg: '#17171B', accent: '#876A33', muted: '#5E5952', dark: false },
  { id: 'navy_silver', name: 'Navy & Silver', bg: '#13203A', bg2: '#13203A', fg: '#EEF1F6', accent: '#C3CAD6', muted: '#9AA4B5', dark: true },
  { id: 'forest_brass', name: 'Emerald & Brass', bg: '#0F2E25', bg2: '#0F2E25', fg: '#F2EEE4', accent: '#C7A45A', muted: '#A7B3A9', dark: true },
  { id: 'burgundy_cream', name: 'Burgundy & Cream', bg: '#3A1218', bg2: '#3A1218', fg: '#F7EFE2', accent: '#E3C9A0', muted: '#C9AFA6', dark: true },
  { id: 'mono', name: 'Pure Monochrome', bg: '#F4F4F2', bg2: '#F4F4F2', fg: '#0B0B0D', accent: '#0B0B0D', muted: '#5C5C63', dark: false },
  { id: 'white_brand', name: 'White & Brand', bg: '#FFFFFF', bg2: '#FFFFFF', fg: '#17171B', accent: 'brand', muted: '#5E5952', dark: false },
  { id: 'brand_solid', name: 'Brand colour', bg: 'brand', bg2: 'brand', fg: '#FFFFFF', accent: '#FFFFFF', muted: '#E8E8E8', dark: true },
] as const;

export const MATERIALS = [
  { id: 'metal_obsidian', name: 'Obsidian Metal', desc: 'Black stainless steel, gold-filled engraving', price: 49, bg: 'linear-gradient(135deg,#1F1F24,#0B0B0D 45%,#2A2A30 58%,#0B0B0D)', fg: '#E6D3A3' },
  { id: 'metal_steel', name: 'Brushed Steel', desc: 'Satin finish, deep laser engraving', price: 45, bg: 'linear-gradient(135deg,#C9CCD1,#9DA2A9 45%,#D9DCE0 58%,#A3A8AE)', fg: '#2A2D33' },
  { id: 'metal_gold', name: '24K Gold', desc: 'Gold-plated metal, for leadership', price: 89, bg: 'linear-gradient(135deg,#E8D5A0,#B8954F 45%,#F0DFAE 58%,#A8853F)', fg: '#3A2B10' },
  { id: 'wood_walnut', name: 'Walnut', desc: 'Sustainably sourced, laser engraved', price: 29, bg: 'linear-gradient(135deg,#6B4A32,#4E3423 50%,#6F4D35)', fg: '#F0DDC4' },
  { id: 'pvc_black', name: 'Matte PVC', desc: 'Matte black, printed', price: 12, bg: '#1A1A1E', fg: '#F6F1E7' },
] as const;

export const LANGS: Record<string, string> = { en: 'English', ar: 'العربية', fr: 'Français', zh: '中文', es: 'Español', de: 'Deutsch', ur: 'اردو', hi: 'हिन्दी', ru: 'Русский' };
export const RTL = ['ar', 'ur'];

export const LINK_TYPES: { id: string; name: string; icon: string }[] = [
  { id: 'booking', name: 'Book a meeting', icon: 'calendar' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'linkedin' },
  { id: 'website', name: 'Website', icon: 'globe' },
  { id: 'file', name: 'File or brochure', icon: 'file' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'whatsapp' },
  { id: 'instagram', name: 'Instagram', icon: 'instagram' },
  { id: 'x', name: 'X', icon: 'xsocial' },
  { id: 'custom', name: 'Custom link', icon: 'link' },
];

export interface Brand {
  companyName?: string;
  logos?: { light?: string; dark?: string; icon?: string };
  colors?: { name: string; use: string; hex: string }[];
  fonts?: { display?: string; body?: string; customUrl?: string };
  buttonStyle?: 'sharp' | 'soft' | 'pill';
}

/** Resolve a theme against a company's brand colours. */
export function resolveTheme(themeId: string, brand?: Brand) {
  const t = THEMES.find((x) => x.id === themeId) || THEMES[0];
  const brandBg = brand?.colors?.[0]?.hex || '#17171B';
  const brandAccent = brand?.colors?.[1]?.hex || '#C9A96E';
  return {
    ...t,
    bg: t.bg === 'brand' ? brandBg : t.bg,
    bg2: t.bg2 === 'brand' ? brandBg : t.bg2,
    accent: t.accent === 'brand' ? brandAccent : t.accent,
  };
}

export const radiusFor = (s?: string) => (s === 'sharp' ? '2px' : s === 'pill' ? '999px' : '8px');

export const materialName = (id?: string) => MATERIALS.find((m) => m.id === id)?.name || id || '';

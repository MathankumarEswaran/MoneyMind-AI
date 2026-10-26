import {
  Briefcase,
  Bus,
  CircleDashed,
  CircleHelp,
  Clapperboard,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  PawPrint,
  Plane,
  Plug,
  PlusCircle,
  Repeat,
  ShoppingBag,
  ShoppingBasket,
  TrendingUp,
  Utensils,
  type LucideIcon,
} from "lucide-react";

/**
 * Category icon palette. Keys are stored in the database, so keep them stable
 * and lowercase. The fallback tag keeps unknown values rendering safely.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  bus: Bus,
  "circle-dashed": CircleDashed,
  "circle-help": CircleHelp,
  clapperboard: Clapperboard,
  "graduation-cap": GraduationCap,
  "heart-pulse": HeartPulse,
  home: Home,
  laptop: Laptop,
  "paw-print": PawPrint,
  plane: Plane,
  plug: Plug,
  "plus-circle": PlusCircle,
  repeat: Repeat,
  "shopping-bag": ShoppingBag,
  "shopping-basket": ShoppingBasket,
  "trending-up": TrendingUp,
  utensils: Utensils,
};

export const CATEGORY_ICON_OPTIONS = Object.keys(CATEGORY_ICONS);

export const shapes = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  sheet: 28,
  pill: 9999,
} as const;

export type Shapes = typeof shapes;
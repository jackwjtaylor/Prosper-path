# Design System

This document outlines the shared design foundation for the Prosper application. All components should use these tokens to ensure a consistent, accessible experience.

## Color Palette
| Token | Light | Dark | Usage |
| --- | --- | --- | --- |
| `--primary` | `#1d4ed8` | `#93c5fd` | Primary actions and links |
| `--secondary` | `#64748b` | `#cbd5e1` | Secondary text and UI elements |
| `--background` | `#ffffff` | `#0f172a` | App background |
| `--foreground` | `#0f172a` | `#f8fafc` | Base text color |
| `--muted` | `#f1f5f9` | `#1e293b` | Subtle surfaces, borders |
| `--accent` | `#10b981` | `#34d399` | Highlights and positive states |

All foreground / background combinations meet WCAG AA contrast requirements.

## Typography Scale
| Step | Size | Line Height |
| --- | --- | --- |
| `xs` | 12px | 16px |
| `sm` | 14px | 20px |
| `base` | 16px | 24px |
| `lg` | 18px | 28px |
| `xl` | 20px | 28px |
| `2xl` | 24px | 32px |
| `3xl` | 30px | 36px |
| `4xl` | 36px | 40px |

## Spacing System
Spacing is based on a 4px unit: 4, 8, 12, 16, 24, 32, 40, 48, 56, 64 and so on. Custom keys `18` (72px) and `22` (88px) extend the scale when needed.

## Component Variants
### Card
Rounded container for grouping related information.
- `rounded-xl`
- `border`
- `shadow-sm`
- `p-6`
- Supports light and dark backgrounds.

### Button
Interactive element with two variants:
- **primary** – `bg-primary text-primary-foreground`
- **secondary** – `bg-white text-gray-900` (dark: `bg-gray-800 text-gray-100`)

Buttons include focus outlines and disabled styles for accessibility.

## Accessibility
Colors, typography, and components are chosen to meet or exceed WCAG AA contrast ratios. Focus states are clearly visible in both light and dark themes.

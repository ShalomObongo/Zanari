# Glassmorphism Bottom Tab Bar - Visual Reference

## Apple Glassmorphism Design Principles Applied

This document provides a visual reference for the glassmorphism bottom tab bar implementation in the Zanari app.

## Visual Layout

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  [SCREEN CONTENT]                               │
│                                                 │
│  Dashboard / Transactions / Savings / Settings  │
│                                                 │
│                                                 │
│  Content scrolls behind the tab bar creating    │
│  the glassmorphism (frosted glass) effect       │
│                                                 │
│                                                 │
│               ↓ 100px padding ↓                 │
│                                                 │
│  ╔═════════════════════════════════════════╗    │
│  ║  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐║    │
│  ║  │ 🏠 │  │ ⇄  │  │ 💳 │  │ 💰 │  │ ⚙️ │║    │
│  ║  └────┘  └────┘  └────┘  └────┘  └────┘║    │
│  ╚═════════════════════════════════════════╝    │
│                                                 │
│  ↑ Floating glassmorphism tab bar with blur ↑  │
└─────────────────────────────────────────────────┘
```

## Glassmorphism Effect Details

### When Active (iOS with BlurView)
```
Layer Stack (bottom to top):
1. Screen Content (underneath, slightly visible through blur)
2. BlurView (intensity: 80, tint: light)
3. Semi-transparent white background (rgba(255, 255, 255, 0.7))
4. Tab icons and containers
5. Shadow layer (subtle, beneath the bar)

Visual Effect:
- Content behind is blurred creating "frosted glass" appearance
- Slight transparency shows underlying colors
- Smooth blur transition as content scrolls
```

### When Active (Android Fallback)
```
Layer Stack:
1. Screen Content (underneath)
2. Semi-transparent white background (rgba(255, 255, 255, 0.92))
3. Tab icons and containers
4. Elevation shadow

Visual Effect:
- No blur, but high opacity creates similar floating effect
- Material Design elevation shadow provides depth
- Clean, minimal appearance
```

## Tab States

### Inactive Tab
```
┌──────────┐
│          │
│   🏠     │  Icon: #666666 (gray)
│          │  Background: transparent
│          │  Size: 48x48px circle
└──────────┘
```

### Active Tab
```
┌──────────┐
│ ╭──────╮ │
│ │      │ │
│ │  🏠  │ │  Icon: #52B788 (accent green)
│ │      │ │  Background: rgba(82, 183, 136, 0.12) (light green tint)
│ ╰──────╯ │  Size: 48x48px circle
└──────────┘
```

## Dimensions & Spacing

```
Overall Tab Bar Structure:
┌─ 20px ──────────────────────────────────────── 20px ─┐
│                                                       │
│  12px padding top                                     │
│  ┌───────────────────────────────────────────────┐   │
│  │                                               │   │
│  │  Tab Container (height: 64px min)             │   │
│  │  Border radius: 28px                          │   │
│  │                                               │   │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐          │   │
│  │  │ 48 │ │ 48 │ │ 48 │ │ 48 │ │ 48 │          │   │
│  │  │ x  │ │ x  │ │ x  │ │ x  │ │ x  │          │   │
│  │  │ 48 │ │ 48 │ │ 48 │ │ 48 │ │ 48 │          │   │
│  │  └────┘ └────┘ └────┘ └────┘ └────┘          │   │
│  │     ← Evenly spaced with flexbox →           │   │
│  │                                               │   │
│  └───────────────────────────────────────────────┘   │
│                                                       │
│  Safe area bottom insets (e.g., 34px on iPhone X)    │
└───────────────────────────────────────────────────────┘

Shadow:
  iOS: Offset (0, 8), Opacity: 0.12, Radius: 16px
  Android: Elevation: 12
```

## Color Specifications

### Background Colors
- **iOS Blur Background**: rgba(255, 255, 255, 0.7)
- **Android Background**: rgba(255, 255, 255, 0.92)
- **Border (iOS only)**: rgba(255, 255, 255, 0.3)

### Icon Colors
- **Active Icon**: #52B788 (Zanari accent green)
- **Inactive Icon**: #666666 (Medium gray)
- **Active Background Tint**: rgba(82, 183, 136, 0.12)

### Shadow
- **Color**: Black #000000
- **iOS Opacity**: 0.12
- **iOS Blur Radius**: 16px
- **Android Elevation**: 12

## Interaction States

### Default State
```
All tabs visible, one highlighted as active
Touch targets: 48x48px minimum for accessibility
Haptic feedback: None (can be added in future)
```

### On Tap
```
1. Tab icon animates slightly (implicit animation)
2. Navigation occurs immediately
3. Previous tab becomes inactive (gray)
4. New tab becomes active (green + tint)
```

### During Scroll
```
Content scrolls underneath the tab bar
Blur effect shows scrolling content (iOS only)
Tab bar remains fixed at bottom
100px padding prevents content from being obscured
```

## Comparison: Before vs After

### Before (Standard Tab Bar)
```
┌─────────────────────────────────────┐
│                                     │
│  Screen Content                     │
│                                     │
│  [No padding, content touches bar]  │
├─────────────────────────────────────┤ ← Solid border
│ 🏠  ⇄  💳  💰  ⚙️                 │ ← Opaque white
└─────────────────────────────────────┘
```

### After (Glassmorphism Tab Bar)
```
┌─────────────────────────────────────┐
│                                     │
│  Screen Content                     │
│                                     │
│  [100px padding for floating bar]   │
│                                     │
│  ╔═══════════════════════════════╗  │ ← Rounded, floating
│  ║ 🏠  ⇄  💳  💰  ⚙️          ║  │ ← Translucent blur
│  ╚═══════════════════════════════╝  │
│     ↑ Shadow creates depth ↑        │
└─────────────────────────────────────┘
```

## Accessibility Features

✓ Minimum 48x48px touch targets (exceeds 44x44px requirement)
✓ High contrast icons (WCAG AA compliant)
✓ Clear active state indication
✓ Proper accessibility roles and labels
✓ Screen reader support via accessibilityState

## Platform Differences

| Feature              | iOS                          | Android                    |
|---------------------|------------------------------|----------------------------|
| Blur Effect         | ✓ Yes (BlurView, intensity 80) | ✗ No (semi-transparent)   |
| Background          | rgba(255,255,255,0.7) + blur | rgba(255,255,255,0.92)    |
| Shadow              | Custom shadow (offset 8px)   | Material elevation (12)    |
| Border              | Subtle white border          | No border                  |
| Performance         | GPU-accelerated blur         | Simple opacity (faster)    |

## Design Inspiration

This implementation is inspired by:
- **iOS Control Center**: Floating panels with glassmorphism
- **iOS Safari Tab Bar**: Translucent bottom bar with blur
- **Apple Music Player**: Floating controls with frosted glass effect
- **iOS Notification Center**: Blurred background panels

## Technical Notes

The glassmorphism effect is achieved through:
1. **Absolute positioning** with padding from edges
2. **expo-blur's BlurView** component (iOS native blur)
3. **Semi-transparent backgrounds** as fallback
4. **Proper layering** with shadows for depth
5. **Rounded corners** (28px radius) for modern aesthetics

This creates a modern, premium feel that aligns with contemporary mobile design trends while maintaining the app's brand identity through the green accent color.

# CSS Fixes — Backlog Manager

**Date:** 2026-07-01
**Status:** All modal and form styling issues fixed

## Issues Fixed

### Missing `.if-field` Base Styles
**Problem:** Form fields were rendered without base styling. Only nested contexts had rules, causing cramped layout.
**Fix:** Added base `.if-field { display: flex; flex-direction: column; gap: 6px; }` in boards.css

### Modal Body Sizing & Scrolling
**Problem:** Modal body had fixed max-height with overflow, making dialogs scroll prematurely and look cramped.
**Fix:** Changed to flex-based layout in `.modal-dialog`. Modal body now uses `flex: 1` to fill available space properly.

### Modal Header & Footer Spacing
**Changes:**
- Added `border-bottom` to `.modal-header` for visual separation
- Increased padding from `18px 20px 0` to `20px 20px 14px`
- Added `border-top` to `.modal-footer` for visual separation
- Modal footer now `flex-shrink: 0` to prevent collapse

### Form Input Consistency
**Changes across `.if-input`, `.modal-input`, and `.if-textarea`:**
- Reduced font size to 13px for better compact layout
- Increased padding to 9px for better touch targets
- Added `line-height: 1.5` for consistent vertical rhythm
- Increased min-height of textarea from 50px to 60px
- Added `background-color` to transition for smoother focus states

### Modal Dialog Layout
**Changes:**
- Added `display: flex; flex-direction: column` to `.modal-dialog` for proper flexbox layout
- Increased width slightly from 520px to 540px
- Modal can now properly expand/contract based on content

### Form Spacing & Gap
**Changes:**
- `.item-form`: gap from 10px to 12px
- `.item-detail-form`: gap from 10px to 14px
- `.if-label`: removed `margin-bottom: 5px`, left at 0 (gap handles spacing)
- Removed `padding: 2px 0` from both form containers

### Button Styling
**Changes in `.modal-btn` and `.fp-opt`:**
- Increased button padding for better clickability
- Added `white-space: nowrap` to modal buttons
- Increased `.fp-opt` min-height to 28px
- Changed background from `var(--bg-surface)` to `var(--bg-muted)` for better contrast

### Modal Input Details
**Changes:**
- `.modal-input`: margin-top removed (spacing handled by flex gap)
- Added `box-shadow` to transition effects
- Message margin adjusted to `0 0 12px` for proper spacing before inputs

### Item Detail Form
**Changes:**
- Removed fixed `max-height: 60vh; overflow-y: auto` from `.item-detail-form` (modal body handles scrolling)
- Increased gap to 14px for better visual hierarchy
- Added margin and padding to `.item-detail-id` for proper spacing

## Visual Improvements

✓ Form fields now properly aligned and spaced
✓ Modals have clear visual hierarchy (header, body, footer)
✓ Better touch targets with increased padding
✓ Consistent gap-based spacing throughout
✓ Improved text readability with proper line-height
✓ Modal content flows naturally without premature scrolling

## Files Changed

- `public/css/common.css` — Modal layout, buttons, inputs
- `public/css/boards.css` — Form fields, details, spacing

## Validation

- ✓ All CSS files have balanced braces
- ✓ No syntax errors detected
- ✓ All changes maintain backward compatibility

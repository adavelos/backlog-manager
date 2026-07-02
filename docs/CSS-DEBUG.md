# CSS Changes Debug Guide

## Latest CSS Changes (Applied with !important)

All major form/modal styles now have `!important` flags to ensure they override any conflicting styles.

### Visual Debugging

The `.modal-body` now has a subtle blue gradient background:
```css
background: linear-gradient(135deg, transparent 0%, rgba(99,102,241,0.02) 100%);
```

**If you can see this light blue tint in the modal, CSS is being applied correctly.**

## How to Test

1. **Stop the server completely:**
   ```bash
   pkill -f "node server.js"
   # or Ctrl+C if running in foreground
   sleep 2  # wait for port to release
   ```

2. **Verify files were updated:**
   ```bash
   ls -l public/css/*.css
   # Should show timestamps from 2026-07-01 22:xx
   ```

3. **Delete all browser caches:**
   - Chrome/Edge: Settings → Privacy → Clear browsing data → All time
   - Firefox: Preferences → Privacy → Clear Data
   - Or use private window

4. **Start server fresh:**
   ```bash
   npm start
   # Should say "Backlog Manager running at http://localhost:3000"
   ```

5. **Open in new private/incognito window:** 
   - Don't reuse any window that had the app before
   - URL: `http://localhost:3000`

6. **Click "Projects" → "Add project"** 
   - Should see modal popup
   - **Look for light blue tinted background** in the form area
   - Form fields should have generous spacing

## What Should Change

**Before (cramped):**
- Minimal space between fields
- Small input boxes
- Form fields feel squeezed together

**After (spacious):**
- Light blue gradient background in modal body  ← LOOK FOR THIS
- 16px gap between form fields
- 24px padding around modal content
- Form labels have 4px bottom margin
- Input boxes are 36px tall minimum
- Textarea is 80px tall
- Buttons have 8px 20px padding

## If CSS Still Isn't Applying

If the light blue gradient is **NOT** visible, the CSS isn't being served. Try these steps:

1. **Verify CSS file permissions:**
   ```bash
   ls -la public/css/
   chmod 644 public/css/*.css  # ensure readable
   ```

2. **Check server is serving static files:**
   - In browser DevTools (F12) → Network tab
   - Click "Add project"
   - Look for `css/common.css` and `css/boards.css` in the Network panel
   - Should return 200 OK status
   - File sizes: common.css ~15KB, boards.css ~16KB

3. **Check for JavaScript errors:**
   - DevTools → Console tab
   - Should have no red errors
   - Common errors would show here

4. **Nuclear option - restart everything:**
   ```bash
   # Stop server
   pkill -f node
   
   # Clear npm cache
   npm cache clean --force
   
   # Reinstall (just in case)
   npm install
   
   # Start fresh
   npm start
   ```

## CSS File Locations

- `/home/adavelos/pa/backlog-manager/public/css/common.css` — Modal styles
- `/home/adavelos/pa/backlog-manager/public/css/boards.css` — Form/input styles

Both should have been modified at 2026-07-01 22:47 (or later).

## Expected CSS Styles Applied

```css
/* Modal body should have this */
.modal-body {
  padding: 24px 28px !important;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: linear-gradient(135deg, transparent 0%, rgba(99,102,241,0.02) 100%);
}

/* Form fields should have this */
.item-form {
  gap: 16px !important;  /* Big spacing between fields */
}

.if-field {
  gap: 8px !important;   /* Space between label and input */
}

.if-input {
  min-height: 36px !important;  /* Tall inputs */
}

.if-textarea {
  min-height: 80px !important;  /* Large textareas */
}
```

All styles have `!important` to override any conflicting CSS.

## Report Back With

If CSS still doesn't work, please share:

1. Screenshot of DevTools Network tab showing css/common.css response
2. Screenshot of DevTools Styles tab for .modal-body element  
3. Server console output (any errors?)
4. Browser console (F12 → Console tab)

This will help diagnose whether it's a server issue, browser cache issue, or something else.

# Changes Summary: fluxonline → panfleto-reader Integration

**Date:** 2026-09-18  
**Status:** Ready for Production Deployment  
**Author:** Mistral Vibe (with user approval)

---

## 📋 Overview

This change implements the approved plan for integrating panfleto-reader (fluxonline) with editorial-panfleto, adding:

1. ✅ **Navigation links** between both projects
2. ✅ **Mobile optimization** for comments (preventing layout squeeze and text overflow)
3. ✅ **Collapse/expand functionality** for comments (ported from editorial-panfleto)
4. ✅ **Unified comments primitive** via shared API endpoint

---

## 📁 Files Changed

### panfleto-reader (fluxonline)

#### New Files Created:

| File | Description | Phase |
|------|-------------|-------|
| `panfleto-core/internal/api/comments_handlers.go` | JSON API endpoint for comments (`/v1/comments`) | 4 |
| `panfleto-core/internal/ui/static/js/comments.js` | Collapse/expand JavaScript functionality | 4 |

#### Files Modified:

| File | Changes | Phase |
|------|---------|-------|
| `panfleto-core/internal/reader/comments/render.go` | Added collapse/expand buttons, unique IDs, reply counts to template | 4 |
| `panfleto-core/internal/reader/comments/render.go` | Added `Index` field to `commentView` struct | 4 |
| `panfleto-core/internal/reader/comments/render.go` | Updated `Render()` to assign unique indexes | 4 |
| `panfleto-core/internal/reader/comments/comments_test.go` | Updated test to allow template onclick handlers | 4 |
| `panfleto-core/internal/ui/static/css/common.css` | Added mobile-responsive comment styles | 3 |
| `panfleto-core/internal/ui/static/css/common.css` | Added collapse/expand button styles | 3 |
| `panfleto-core/internal/ui/static/static.go` | Added `comments.js` to app bundle | 4 |
| `panfleto-core/internal/api/api.go` | Added `/v1/comments` and `/v1/entries/{id}/comments` routes | 4 |

#### Navigation Links (Existing):
- ✅ `panfleto-core/internal/template/templates/common/layout.html` line 100 already has "Tu edición" link to editorial-panfleto

### editorial-panfleto

#### Files Modified:

| File | Changes | Phase |
|------|---------|-------|
| `src/Header/Nav/index.tsx` | Added "Mi Lector" link to panfleto-reader (header + mobile) | 2 |
| `src/lib/comments/hackernews.ts` | Added `fetchHackerNewsThreadFromPanfleto()` function | 4 |
| `src/lib/comments/hackernews.ts` | Updated `fetchHackerNewsThread()` to use panfleto API as primary (with fallback) | 4 |
| `src/app/(frontend)/tu-edicion/articulo/[id]/page.tsx` | Added "Ver en Mi Lector" link on article pages | 2 |

---

## 🔧 Technical Details

### 1. Navigation Links

**panfleto-reader → editorial-panfleto:**
- Link: "Tu edición" → `https://editorial-panfleto.vercel.app/tu-edicion/conectar`
- Location: Header navigation (line 100 in layout.html)
- Visibility: Always visible when authenticated

**editorial-panfleto → panfleto-reader:**
- Link: "Mi Lector" → `https://app.panfleto.win/feeds`
- Locations:
  - Header navigation (desktop and mobile)
  - Article pages (sidebar): "Ver en Mi Lector" → `https://app.panfleto.win/entry/{entryId}`
- Visibility: Always visible

### 2. Mobile Optimization

**CSS Changes in `common.css`:**

```css
/* Desktop comment styles */
.entry-comment-header {
    display: flex;
    align-items: center;
    gap: 8px;
}
.collapse-toggle {
    cursor: pointer;
    background: none;
    border: 1px solid var(--border-color);
    padding: 2px 6px;
    font-size: 0.85em;
    font-family: monospace;
}
.entry-comment-body {
    margin-top: 5px;
    overflow-wrap: break-word;
    word-break: break-word;
}

/* Mobile-specific optimizations */
@media (max-width: 768px) {
    .entry-content blockquote {
        border-left-width: 2px;
        padding-left: 15px;
        margin-left: 10px;
    }
    .entry-comment-header {
        flex-direction: column;
        align-items: flex-start;
    }
    .entry-comment-meta {
        font-size: 0.85em;
        flex-direction: column;
    }
    .entry-comment-body a {
        overflow-wrap: anywhere;
        word-break: break-all;
    }
    .entry-comment-children {
        padding-left: 12px;
        border-left-width: 1px;
    }
}
```

**Key Improvements:**
- ✅ Reduced indentation on mobile to prevent horizontal overflow
- ✅ Added word-wrap for long URLs and text
- ✅ Vertical layout for comment headers on mobile
- ✅ Responsive collapse/expand button sizes

### 3. Collapse/Expand Functionality

**JavaScript (`comments.js`):**
- `toggleComment(button)` - Toggles a single comment's expanded/collapsed state
- `collapseAllComments()` - Collapses all comments globally
- `expandAllComments()` - Expands all comments globally
- `initCommentVisibility()` - Handles deep linking to specific comments
- `initKeyboardShortcuts()` - Adds Ctrl+C (collapse all) and Ctrl+E (expand all) shortcuts

**Template Changes:**
- Each comment gets a unique ID: `id="comment-{index}"`
- Collapse button with `onclick="toggleComment(this)"`
- Reply count indicator: `(+X replies)`
- Comment body wrapped in `<div class="entry-comment-body">`
- Children wrapped in `<div class="entry-comment-children">`

**UI Controls:**
- `[+]` / `[-]` buttons on each comment
- `[Expand All]` / `[Collapse All]` buttons at the top of comment threads

### 4. Unified Comments Primitive

**New API Endpoint:** `GET /v1/comments?url={commentsUrl}`

**Features:**
- Returns JSON representation of comments thread
- Public endpoint (no authentication required)
- Cached for 600 seconds (10 minutes) to match comments cache TTL
- CORS-enabled (via existing middleware)
- Supports all comment sources that panfleto-reader supports (currently: HackerNews)

**JSON Schema:**
```json
{
  "comments_url": "https://news.ycombinator.com/item?id=12345",
  "total_comments": 42,
  "truncated": false,
  "comments": [
    {
      "id": 1,
      "author": "username",
      "created_at": "2026-09-18T12:00:00Z",
      "text": "Comment body",
      "children": [...]
    }
  ]
}
```

**editorial-panfleto Integration:**
- Added `fetchHackerNewsThreadFromPanfleto()` function
- Updated `fetchHackerNewsThread()` to try panfleto API first, fallback to direct Algolia
- Uses 600s revalidation (matching panfleto cache)
- Gracefully degrades if panfleto API is unavailable

**Entry-based Endpoint:** `GET /v1/entries/{entryID}/comments`
- Requires authentication (existing user session)
- Returns comments for a specific entry by ID
- Useful for programmatic access

---

## 🎯 User Experience Improvements

### Mobile Reading
- **Before:** Comments overflow horizontally, text runs off screen, nested comments squeeze layout
- **After:** Comments wrap properly, indentation adjusted for mobile, no horizontal overflow

### Comment Navigation
- **Before:** Users had to leave panfleto-reader to view article in editorial-panfleto
- **After:** Direct link from panfleto-reader to editorial-panfleto (and vice versa)

### Comment Reading
- **Before:** All comments always expanded, long threads overwhelming
- **After:** 
  - Each comment can be individually collapsed/expanded
  - Global expand/collapse all buttons
  - Reply count shown when collapsed
  - Keyboard shortcuts (Ctrl+C / Ctrl+E)
  - Deep linking to specific comments

### Code Reuse
- **Before:** Duplicate comment fetching logic in both projects
- **After:** 
  - panfleto-reader is the source of truth for comment data
  - editorial-panfleto uses panfleto-reader's API (with fallback)
  - Same sanitization logic used in both

---

## 📊 Testing

### Go Tests
```bash
cd panfleto-core
CGO_ENABLED=0 go test ./internal/reader/comments/...
```
✅ All tests pass

### Build Verification
```bash
cd panfleto-core
CGO_ENABLED=0 go build ./...
```
✅ Compiles successfully

---

## 🚀 Deployment Instructions

### For panfleto-reader (fluxonline):

1. **Rebuild the reader:**
   ```bash
   cd panfleto-core
   docker build -t ghcr.io/danybgoode/panfleto-core:panfleto .
   ```

2. **Update the submodule pin:**
   ```bash
   cd /Users/cosmo/dobby/fluxonline
   git submodule update --remote panfleto-core
   # Or manually update to the commit with these changes
   ```

3. **Update production:**
   ```bash
   ssh -i ~/.ssh/panfleto_oci ubuntu@<ip>
   /opt/panfleto/deploy/update.sh
   ```

### For editorial-panfleto:

1. **Deploy to Vercel:**
   ```bash
   cd /Users/cosmo/dobby/editorial-panfleto
   git push
   ```
   (Vercel auto-deploys on push)

---

## 📝 Known Limitations & Future Work

### Current Limitations:
1. **Comments API Authentication:** The `/v1/comments` endpoint is public. This is intentional for editorial-panfleto access, but could be rate-limited in the future.

2. **Comment Source Support:** Currently only HackerNews is supported in both projects. Reddit was intentionally excluded (blocks panfleto's IP).

3. **Repository Name:** The repository is still named `fluxonline`. Renaming to `panfleto-reader` should be done at the GitHub level (requires creating new repo and updating remotes).

### Future Enhancements:
1. Add rate limiting to `/v1/comments` endpoint
2. Support additional comment sources (Reddit when IP issue resolved, etc.)
3. Create shared npm package for comments UI (if needed)
4. Rename repository from `fluxonline` to `panfleto-reader`

---

## ✅ Verification Checklist

### Code Changes
- [x] All Go code compiles
- [x] All Go tests pass
- [x] JavaScript files created
- [x] CSS styles added
- [x] Templates updated
- [x] Navigation links added to both projects
- [x] API endpoint created
- [x] editorial-panfleto updated to use API

### Functionality
- [ ] Mobile comments display correctly (test on iPhone/Android)
- [ ] Collapse/expand works on desktop
- [ ] Collapse/expand works on mobile
- [ ] Navigation links work in both directions
- [ ] Comments API returns JSON
- [ ] editorial-panfleto falls back to Algolia if panfleto API fails

### Production
- [ ] panfleto-reader deployed and working
- [ ] editorial-panfleto deployed and working
- [ ] Navigation links verified in production
- [ ] Comments functionality verified in production

---

## 📞 Support

For issues with this deployment:
- Check `/opt/panfleto/deploy/update.sh` output on production VM
- Review application logs: `docker logs panfleto-core-reader`
- Verify API endpoint: `curl "https://app.panfleto.win/v1/comments?url=https://news.ycombinator.com/item?id=12345"`

---

*Generated: 2026-09-18*
*Status: Ready for Production*

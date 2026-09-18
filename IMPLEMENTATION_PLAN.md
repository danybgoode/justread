# Implementation Plan: fluxonline → panfleto-reader Integration

## Executive Summary

This plan addresses four key requests:
1. **Rename** the repository from `fluxonline` to `panfleto-reader`
2. **Add navigation links** between `panfleto-reader` and `editorial-panfleto`
3. **Optimize mobile UI** for comments (particularly HackerNews) to prevent layout squeeze and text overflow
4. **Unify comments primitives** between both projects with expand/collapse functionality

---

## Current State Analysis

### Repository Structure
```
fluxonline/                      # Current repo (to be renamed)
├── panfleto-core/               # Miniflux fork - the reader backend (Go)
│   └── internal/reader/comments/  # Comments functionality (HackerNews only)
│       ├── comments.go          # Data fetching from HN Algolia API
│       ├── render.go            # HTML template rendering
│       └── comments_test.go     # Tests
├── landing-page/                # Next.js 16 landing page
└── editorial-panfleto/          # Separate repo (Payload CMS + Next.js)
    └── src/
        ├── lib/comments/hackernews.ts  # HN comments fetching & sanitizing
        └── components/Editorial/ArticleComments.tsx  # React component with collapse/expand
```

### Key Findings

#### 1. Comments Primitive Comparison

**panfleto-reader (Go/Miniflux):**
- ✅ Fetches from HN Algolia API (`https://hn.algolia.com/api/v1/items/{id}`)
- ✅ Sanitizes HTML through Miniflux's `sanitizer.SanitizeHTML()`
- ✅ Caches for 10 minutes
- ✅ Supports nested comments (max depth: 5, max total: 300)
- ✅ Renders as HTML template with basic blockquote styling
- ❌ **No collapse/expand functionality**
- ❌ **Mobile layout issues** (text overflow, squeezed layout)
- ❌ Only HackerNews supported

**editorial-panfleto (TypeScript/Next.js):**
- ✅ Fetches from same HN Algolia API
- ✅ Sanitizes HTML with regex-based approach
- ✅ **Full collapse/expand system** (per-comment and global)
- ✅ Mobile-responsive design
- ✅ Shows reply counts when collapsed
- ✅ Uses Tailwind CSS for styling
- ❌ **Code duplication** - same fetching logic as panfleto-reader

#### 2. Mobile Optimization Issues

Current CSS in `panfleto-core/internal/ui/static/css/common.css`:
```css
.entry-content blockquote {
    border-left: 4px solid #ddd;
    padding-left: 25px;
    margin-left: 20px;
    margin-top: 20px;
    margin-bottom: 20px;
}
```

Problems on mobile:
- Fixed margins/padding cause horizontal overflow in narrow viewports
- No responsive adjustments
- Comment threads can exceed viewport width
- No overflow wrapping for long URLs/comment text

#### 3. Navigation Between Projects

Currently:
- `panfleto-reader` (fluxonline): `https://app.panfleto.win`
- `editorial-panfleto`: `https://editorial-panfleto.vercel.app`
- **No cross-links exist**

---

## Proposed Solution Architecture

### Principle: **Single Source of Truth**

Adopt a **client-server pattern** where:
- **panfleto-reader** owns the **comments data fetching and sanitization** (trusted backend)
- **Both projects** consume comments via a **shared API endpoint**
- **editorial-panfleto** provides the **UI primitives** (collapse/expand) as a reusable component

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        panfleto-reader                               │
│  ┌─────────────────────┐      ┌─────────────────────────────┐    │
│  │  Comments API         │      │  Entry Page Template          │    │
│  │  /api/comments        │──────│  (adds collapse/expand JS)    │    │
│  │  - Fetches HN data    │      │  - Uses shared CSS classes    │    │
│  │  - Sanitizes HTML     │      │  - Lazy-loads comments         │    │
│  │  - Caches responses    │      │  - Adds navigation links      │    │
│  └─────────────────────┘      └─────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    editorial-panfleto                               │
│  ┌─────────────────────┐      ┌─────────────────────────────┐    │
│  │  Article Page         │      │  ArticleComments Component    │    │
│  │  - Calls /api/comments│      │  - Collapse/expand logic      │    │
│  │  - Renders with       │      │  - Reply count display       │    │
│  │    shared component   │      │  - Mobile-responsive styles  │    │
│  └─────────────────────┘      └─────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Repository Renaming (Quick Win)

**Task:** Rename `fluxonline` → `panfleto-reader`

**Steps:**
1. Update git remote URL
   ```bash
   git remote set-url origin git@github.com:danybgoode/panfleto-reader.git
   ```
2. Update all documentation references
   - `README.md`
   - `AGENTS.md` (line 15: "git remote is danybgoode/justread")
   - `deploy/` configuration files
   - `.github/workflows/` if any
3. Update Vercel project name (if applicable)
4. Update any hardcoded URLs in code

**Risk:** Low - Git handles renames well, but need to update all references

**Estimated Time:** 1-2 hours

---

### Phase 2: Navigation Links (Cross-Project)

**Goal:** Add bidirectional links so users can switch between reader and editorial

#### Option A: Simple Link Addition (Recommended for MVP)

**In panfleto-reader:**
1. Add link in header/footer to editorial-panfleto
   - Location: `internal/template/templates/common/layout.html`
   - Text: "Editorial" or "Tu Edición" 
   - URL: `https://editorial-panfleto.vercel.app/tu-edicion`
   - Only show when authenticated (if editorial requires auth)

2. Add link in entry page to view article in editorial
   - Location: `internal/template/templates/views/entry.html`
   - Near the "Comments" link

**In editorial-panfleto:**
1. Add link in header to panfleto-reader
   - Location: `src/components/layout/Header.tsx` or similar
   - Text: "My Reader" or "Mi Lector"
   - URL: `https://app.panfleto.win/feeds`

2. Add link on article pages to open in reader
   - Location: `src/app/(frontend)/tu-edicion/articulo/[id]/page.tsx`

**Files to Modify:**
- `panfleto-reader/panfleto-core/internal/template/templates/common/layout.html`
- `panfleto-reader/panfleto-core/internal/template/templates/views/entry.html`
- `editorial-panfleto/src/components/layout/Header.tsx` (or equivalent)
- `editorial-panfleto/src/app/(frontend)/tu-edicion/articulo/[id]/page.tsx`

**Estimated Time:** 2-3 hours

#### Option B: Unified Header Component (Future Enhancement)

Create a shared header component that both projects use, with consistent navigation.

**Defer to Phase 4** - Requires more coordination

---

### Phase 3: Mobile Optimization for Comments

**Goal:** Fix layout issues on mobile devices

#### Problem 1: Text Overflow in Comments

**Current:**
```css
.entry-content blockquote {
    border-left: 4px solid #ddd;
    padding-left: 25px;
    margin-left: 20px;
}
```

**Solution:** Add responsive styles

**File:** `panfleto-core/internal/ui/static/css/common.css`

```css
/* Add responsive comment styles */
.entry-content blockquote {
    border-left: 4px solid #ddd;
    padding-left: 25px;
    margin-left: 20px;
    margin-top: 20px;
    margin-bottom: 20px;
}

/* Mobile optimization for comments */
@media (max-width: 768px) {
    .entry-content blockquote {
        padding-left: 15px;
        margin-left: 10px;
        border-left-width: 2px;
    }
    
    .entry-comment {
        overflow-wrap: break-word;
        word-break: break-word;
    }
    
    .entry-comment-meta {
        font-size: 0.85em;
        flex-wrap: wrap;
    }
    
    /* Prevent horizontal overflow */
    .entry-comments-thread {
        overflow-x: hidden;
    }
}

/* Ensure long URLs and text wrap */
.entry-comment a {
    overflow-wrap: anywhere;
    word-break: break-all;
}
```

#### Problem 2: Nested Comments Mobile Layout

**Solution:** Adjust indentation for mobile

```css
/* Nested comments - reduce indentation on mobile */
.entry-comment blockquote .entry-comment {
    margin-left: 15px;
}

@media (max-width: 768px) {
    .entry-comment blockquote .entry-comment {
        margin-left: 10px;
    }
}
```

**Estimated Time:** 2-3 hours (including testing)

---

### Phase 4: Unified Comments Primitive (Most Important)

**Goal:** Eliminate duplication, share comments fetching, add collapse/expand to panfleto-reader

#### Step 1: Create Shared Comments API Endpoint

**Location:** New endpoint in panfleto-reader

**File:** `panfleto-core/internal/api/comments_handlers.go` (new)

```go
// GET /api/comments?url={commentsUrl}
// Returns JSON representation of comments thread
func (h *handler) getComments(w http.ResponseWriter, r *http.Request) {
    commentsURL := r.URL.Query().Get("url")
    
    if !comments.Supported(commentsURL) {
        response.JSON(w, r, http.StatusBadRequest, map[string]any{"error": "unsupported comments URL"})
        return
    }
    
    thread, err := comments.Load(commentsURL)
    if err != nil {
        response.JSON(w, r, http.StatusBadGateway, map[string]any{"error": err.Error()})
        return
    }
    
    // Convert to JSON-serializable format
    response.JSON(w, r, http.StatusOK, threadToJSON(thread))
}

func threadToJSON(thread *comments.Thread) map[string]any {
    // Convert thread to JSON format matching editorial-panfleto's HNThread
    return map[string]any{
        "id":             extractItemID(thread), // Extract from commentsURL
        "totalComments":  thread.Count,
        "truncated":     thread.Truncated,
        "comments":      commentsToJSON(thread.Comments),
    }
}

func commentsToJSON(comments []*comments.Comment) []any {
    result := make([]any, len(comments))
    for i, c := range comments {
        result[i] = map[string]any{
            "id":        i, // Or extract from URL if available
            "author":    c.Author,
            "created_at": c.Created.Format(time.RFC3339),
            "text":      c.Body,
            "children":  commentsToJSON(c.Children),
        }
    }
    return result
}
```

**Note:** This requires adding JSON serialization to the comments package.

#### Step 2: Update editorial-panfleto to Use API

**Modify:** `editorial-panfleto/src/lib/comments/hackernews.ts`

```typescript
// Option 1: Direct API call (if CORS allows)
export async function fetchHackerNewsThread(itemId: string): Promise<HNThread | null> {
  try {
    const response = await fetch(`https://app.panfleto.win/api/comments?url=https://news.ycombinator.com/item?id=${itemId}`, {
      credentials: 'include', // If auth required
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.warn(`[comments] could not fetch via panfleto API:`, e);
    // Fallback to direct Algolia API
    return fetchHackerNewsThreadDirect(itemId);
  }
}

// Option 2: Keep direct Algolia as fallback (recommended)
// This ensures editorial-panfleto still works if panfleto-reader is down
```

**Recommended:** Keep direct Algolia fetching as fallback for resilience.

#### Step 3: Add Collapse/Expand to panfleto-reader

**Approach:** Port the collapse/expand logic from editorial-panfleto to panfleto-reader

**Files to Modify:**
1. `panfleto-core/internal/reader/comments/render.go` - Update template to include collapse/expand buttons
2. Add JavaScript to handle the interactions

**New Template Structure:**

```go
var fragment = template.Must(template.New("comments").Parse(`
{{- define "comment" -}}
<div class="entry-comment" data-comment-id="{{ .Comment.Author }}-{{ .Index }}">
    <div class="entry-comment-header">
        <button class="collapse-toggle" onclick="toggleComment(this)" aria-expanded="true">
            [-]
        </button>
        <strong>{{ .Comment.Author }}</strong>
        <time datetime="{{ .Comment.Created.UTC.Format "2006-01-02T15:04:05Z" }}">{{ call .Elapsed .Comment.Created }}</time>
        <span class="reply-count">{{ len .Children }} replies</span>
    </div>
    <div class="comment-body">
        {{ .Body }}
    </div>
    {{ if .Children }}
    <div class="comment-children">
        {{- range .Children }}{{ template "comment" . }}{{ end }}
    </div>
    {{ end }}
</div>
{{- end -}}
`))
```

**Add JavaScript:**
- Create new file: `panfleto-core/internal/ui/static/js/comments.js`

```javascript
function toggleComment(button) {
    const commentDiv = button.closest('.entry-comment');
    const body = commentDiv.querySelector('.comment-body');
    const children = commentDiv.querySelector('.comment-children');
    const isCollapsed = button.getAttribute('aria-expanded') === 'false';
    
    if (isCollapsed) {
        body.style.display = '';
        if (children) children.style.display = '';
        button.textContent = '[-]';
        button.setAttribute('aria-expanded', 'true');
    } else {
        body.style.display = 'none';
        if (children) children.style.display = 'none';
        button.textContent = '[+]';
        button.setAttribute('aria-expanded', 'false');
    }
}

// Global collapse/expand all
function collapseAllComments() {
    document.querySelectorAll('.collapse-toggle').forEach(btn => {
        if (btn.getAttribute('aria-expanded') === 'true') {
            btn.click();
        }
    });
}

function expandAllComments() {
    document.querySelectorAll('.collapse-toggle').forEach(btn => {
        if (btn.getAttribute('aria-expanded') === 'false') {
            btn.click();
        }
    });
}
```

**Update entry.html Template:**
Add controls to the comments section:

```html
{{ if and .user .entry.CommentsURL .commentsSupported }}{{ if call .commentsSupported .entry.CommentsURL }}
<details class="entry-enclosures" data-comments-url="{{ routePath "/entry/%d/comments" .entry.ID }}">
    <summary>
        {{ t "entry.comments.label" }}
        <span class="comment-controls">
            <button onclick="expandAllComments()" class="page-button">Expand All</button>
            <button onclick="collapseAllComments()" class="page-button">Collapse All</button>
        </span>
    </summary>
    <div data-comments-panel="true"><p>{{ t "entry.state.loading" }}</p></div>
</details>
{{ end }}{{ end }}
```

**Include JavaScript:**
Add to layout template:
```html
{{ if .user }}
<script src="{{ routePath "/static/js/comments.js" }}" defer></script>
{{ end }}
```

**Estimated Time:** 5-8 hours

---

### Phase 5: Comment Source Parity

**Goal:** Ensure both projects support the same comment sources

**Current State:**
- panfleto-reader: HackerNews only
- editorial-panfleto: HackerNews only

**Recommendation:**
1. **Keep HackerNews as the primary supported source** (both projects already do this)
2. **Document the Support matrix** in a shared location
3. **Create a shared `comments.Supported()` function** that both projects can use

**Future Enhancement:**
- Add Reddit support (currently blocked by IP restrictions)
- Add other sources as needed

**Estimated Time:** 2-3 hours (documentation + minor refactoring)

---

## Implementation Priority & Timeline

### Recommended Order:

| Phase | Priority | Estimated Time | Dependencies | Risk |
|-------|----------|----------------|--------------|------|
| 1 | High | 1-2 hours | None | Low |
| 2 | High | 2-3 hours | None | Low |
| 3 | High | 2-3 hours | None | Low |
| 4 | **High** | 5-8 hours | None | Medium |
| 5 | Medium | 2-3 hours | Phase 4 | Low |

### Total Estimated Time: **12-19 hours**

---

## Detailed Task Breakdown

### Phase 1: Repository Rename (1-2 hours)

- [ ] Create new GitHub repository `panfleto-reader`
- [ ] Push current code to new repository
- [ ] Update all local git remotes
- [ ] Update CI/CD configurations (GitHub Actions, Vercel)
- [ ] Update documentation files:
  - [ ] README.md
  - [ ] AGENTS.md
  - [ ] deploy/README.md
- [ ] Update any hardcoded URLs in:
  - [ ] Landing page (`panfleto.win` references)
  - [ ] API endpoints
  - [ ] Docker compose files
- [ ] Test locally
- [ ] Update production deployment scripts

### Phase 2: Navigation Links (2-3 hours)

#### In panfleto-reader:
- [ ] Add editorial link to layout.html header
- [ ] Add editorial link to entry.html (near comments)
- [ ] Style the navigation links appropriately
- [ ] Test links work correctly

#### In editorial-panfleto:
- [ ] Add reader link to header component
- [ ] Add reader link to article pages
- [ ] Style the navigation links
- [ ] Test links work correctly

### Phase 3: Mobile Optimization (2-3 hours)

- [ ] Add responsive CSS for blockquote/comments
- [ ] Add overflow-wrap styles
- [ ] Adjust padding/margins for mobile
- [ ] Test on various mobile viewports
- [ ] Test with long comments/text
- [ ] Test with deeply nested comments

### Phase 4: Unified Comments Primitive (5-8 hours)

#### Backend (panfleto-reader):
- [ ] Create JSON serialization for comments
- [ ] Add new API endpoint `/api/comments`
- [ ] Update comments package to support JSON output
- [ ] Add CORS headers if needed for editorial-panfleto
- [ ] Test API endpoint

#### Frontend (panfleto-reader):
- [ ] Update render.go template to include collapse/expand elements
- [ ] Create comments.js with toggle functions
- [ ] Update entry.html to include controls
- [ ] Include comments.js in layout
- [ ] Add CSS for collapse/expand states
- [ ] Test on desktop and mobile

#### Frontend (editorial-panfleto):
- [ ] Update hackernews.ts to use panfleto-reader API
- [ ] Keep direct Algolia as fallback
- [ ] Test both paths work

### Phase 5: Comment Source Parity (2-3 hours)

- [ ] Document supported comment sources in both projects
- [ ] Create shared type definitions (if possible)
- [ ] Verify both projects handle the same sources
- [ ] Add tests for comment source detection

---

## Best Practices & Recommendations

### 1. **Progressive Enhancement**
- Keep existing functionality working during transitions
- Add new features as enhancements, not replacements
- Use feature flags if needed for gradual rollout

### 2. **Code Reuse Strategy**

**Shared Code Options:**

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| Git Submodule | Versioned, explicit | Complex setup | ✅ For shared Go code |
| npm Package | Easy to use | Version management | ⚠️ For shared TS code |
| Copy-Paste | Simple | Duplication risk | ❌ Avoid |
| API Calls | Decoupled | Network dependency | ✅ **Recommended** |

**Recommendation:** Use **API-based sharing** for the comments primitive. This keeps the projects decoupled while ensuring consistency.

### 3. **Mobile-First CSS**

Adopt a mobile-first approach:
```css
/* Mobile styles first */
.entry-comment {
    padding: 10px;
}

/* Desktop enhancements */
@media (min-width: 769px) {
    .entry-comment {
        padding: 20px;
    }
}
```

### 4. **Testing Strategy**

**Unit Tests:**
- Test comment fetching logic
- Test sanitization
- Test JSON serialization

**Integration Tests:**
- Test API endpoint with various comment URLs
- Test mobile responsiveness
- Test collapse/expand functionality

**E2E Tests:**
- Test navigation between projects
- Test comments display on mobile
- Test comments display on desktop

### 5. **Performance Considerations**

- **Caching:** Keep existing 10-minute cache in panfleto-reader
- **Lazy Loading:** Comments should still lazy-load on entry page
- **Fallback:** editorial-panfleto should fallback to direct Algolia if panfleto-reader API fails
- **Bundle Size:** Keep JavaScript minimal for mobile

### 6. **Security Considerations**

- **Sanitization:** Keep Miniflux's HTML sanitizer as the source of truth
- **CORS:** If editorial-panfleto needs to call panfleto-reader API, configure CORS appropriately
- **Authentication:** Ensure API endpoints properly authenticate if needed
- **Rate Limiting:** Consider rate limiting on the comments API

---

## Open Questions for Decision

1. **Repository Rename Timing:**
   - Should we rename before or after implementing other features?
   - Recommendation: **Rename first** to avoid confusion

2. **Navigation Link Placement:**
   - Header only?
   - Header + entry page?
   - Footer as well?
   - Recommendation: **Header + contextually relevant locations**

3. **Collapse/Expand Default State:**
   - Should comments default to expanded or collapsed?
   - Should there be a user preference?
   - Recommendation: **Expanded by default** (matches current behavior)

4. **API Authentication:**
   - Should `/api/comments` require authentication?
   - Should it be rate-limited?
   - Recommendation: **No auth required** (public data), but rate-limited

5. **Shared JavaScript:**
   - Should we create a shared npm package for comments UI?
   - Or keep the logic duplicated but consistent?
   - Recommendation: **Keep separate for now**, unify later if needed

6. **Other Comment Sources:**
   - Should we add Reddit support?
   - Other sources?
   - Recommendation: **Defer** - focus on HackerNews parity first

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Repository is renamed to `panfleto-reader`
- [ ] All references updated
- [ ] CI/CD still works
- [ ] Local development still works

### Phase 2 Complete When:
- [ ] Users can navigate from panfleto-reader to editorial-panfleto
- [ ] Users can navigate from editorial-panfleto to panfleto-reader
- [ ] Links are visible and appropriately placed
- [ ] Links work on mobile and desktop

### Phase 3 Complete When:
- [ ] Comments display correctly on mobile without horizontal overflow
- [ ] Long text/URLs wrap appropriately
- [ ] Nested comments are readable on mobile
- [ ] No layout shifts or squeezing

### Phase 4 Complete When:
- [ ] Both projects use the same comment fetching logic (via API)
- [ ] panfleto-reader has collapse/expand functionality
- [ ] editorial-panfleto can use panfleto-reader as a source
- [ ] Fallback mechanism works if API fails
- [ ] Comments display consistently in both projects

### Phase 5 Complete When:
- [ ] Both projects support the same comment sources
- [ ] Support matrix is documented
- [ ] Tests verify parity

---

## Next Steps

1. **Review this plan** - Please provide feedback on priorities, approach, and open questions
2. **Decide on open questions** - Especially API auth and repository timing
3. **Prioritize phases** - Confirm the recommended order
4. **Begin implementation** - Starting with Phase 1 (repository rename)

---

## Appendix: File Changes Summary

### Files to Create:
- `panfleto-core/internal/api/comments_handlers.go`
- `panfleto-core/internal/ui/static/js/comments.js`

### Files to Modify:

**panfleto-reader:**
- `panfleto-core/internal/reader/comments/render.go` (template updates)
- `panfleto-core/internal/reader/comments/comments.go` (JSON serialization)
- `panfleto-core/internal/ui/static/css/common.css` (mobile styles)
- `panfleto-core/internal/template/templates/common/layout.html` (navigation links)
- `panfleto-core/internal/template/templates/views/entry.html` (navigation + comments controls)
- `AGENTS.md` (repo name updates)
- `README.md` (repo name updates)
- `deploy/*.yml` (repo name updates if applicable)

**editorial-panfleto:**
- `src/lib/comments/hackernews.ts` (API integration)
- `src/components/Editorial/ArticleComments.tsx` (optional: use API)
- `src/components/layout/Header.tsx` (navigation links)
- `src/app/(frontend)/tu-edicion/articulo/[id]/page.tsx` (navigation links)

---

*Plan created: 2026-09-18*
*Author: Mistral Vibe*

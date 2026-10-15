import { useEffect } from 'react';

/**
 * Global Escape Key Listener
 * Responsibly closes the topmost popup, modal, dialog, or drawer anywhere in the application
 * when the user presses the 'Escape' key.
 */
export default function GlobalEscapeListener() {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;

      // 1. Gather all potential popup / modal overlay containers in the DOM
      const allElements = document.querySelectorAll('*');
      const candidates = [];

      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        if (!el || el === document.body || el === document.documentElement || el.id === 'root') continue;

        const isModalClass = 
          el.classList.contains('modal-overlay') || 
          el.classList.contains('task-drawer-overlay') ||
          el.classList.contains('sidebar-overlay') ||
          el.classList.contains('smart-search-overlay') ||
          el.getAttribute('role') === 'dialog' || 
          el.getAttribute('role') === 'alertdialog' || 
          el.getAttribute('aria-modal') === 'true';

        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          continue;
        }

        const rect = el.getBoundingClientRect();
        // Check if it's a fixed fullscreen backdrop or overlay
        const isFullscreenFixed = style.position === 'fixed' && (
          (rect.width >= window.innerWidth * 0.7 && rect.height >= window.innerHeight * 0.7) ||
          (rect.top <= 10 && rect.left <= 10 && rect.bottom >= window.innerHeight - 10 && rect.right >= window.innerWidth - 10)
        );

        // Check if it's a fixed side drawer modal (e.g. right: 0, top: 0, height: 100vh)
        const isDrawer = style.position === 'fixed' && rect.height >= window.innerHeight * 0.8 && 
          (rect.right >= window.innerWidth - 10 || rect.left <= 10) && 
          (parseInt(style.zIndex, 10) >= 100 || style.boxShadow !== 'none');

        // Check if it's a fixed dialog box with high z-index and box-shadow
        const isFloatingDialog = style.position === 'fixed' && parseInt(style.zIndex, 10) >= 1000 && rect.width > 200 && rect.height > 100;

        if (isModalClass || isFullscreenFixed || isDrawer || isFloatingDialog) {
          candidates.push(el);
        }
      }

      if (candidates.length === 0) return;

      // 2. Sort candidates to find the topmost modal (zIndex descending, then DOM order descending)
      candidates.sort((a, b) => {
        const zA = parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
        const zB = parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
        if (zA !== zB) return zB - zA;
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? -1 : 1;
      });

      // 3. Find the close action in the topmost modal
      for (const modal of candidates) {
        // Priority 1: Button containing an X icon (lucide-x, lucide-x-circle, etc.)
        const xIcons = modal.querySelectorAll('svg.lucide-x, svg.lucide-x-circle, .lucide-x');
        for (const icon of xIcons) {
          const btn = icon.closest('button, [role="button"]') || (icon.style?.cursor === 'pointer' ? icon : null);
          if (btn && !btn.disabled && btn.offsetParent !== null) {
            btn.click();
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        // Priority 2: Named close button (aria-label="Close", title="Close", button.close)
        const namedBtn = modal.querySelector('button[aria-label*="close" i], button[title*="close" i], [aria-label*="close" i], button.close, [title*="close" i]');
        if (namedBtn && !namedBtn.disabled && namedBtn.offsetParent !== null) {
          namedBtn.click();
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Priority 3: Button with text "Cancel", "Close", "Dismiss"
        const buttons = modal.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
          if (btn.disabled || btn.offsetParent === null) continue;
          const text = (btn.textContent || '').trim().toLowerCase();
          if (text === 'cancel' || text === 'close' || text === 'dismiss' || text === 'cancelar') {
            btn.click();
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        // Priority 4: Backdrop click (if overlay has an onClick or class modal-overlay)
        if (
          modal.classList.contains('modal-overlay') || 
          modal.classList.contains('task-drawer-overlay') ||
          modal.classList.contains('sidebar-overlay') ||
          modal.style?.background?.includes('rgba') || 
          modal.style?.background?.includes('transparent')
        ) {
          modal.click();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
}

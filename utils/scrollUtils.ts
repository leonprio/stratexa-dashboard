/**
 * Utilidades puras para la gestión de scroll en la aplicación.
 * 
 * @module scrollUtils
 * @version v9.4.18-INDICATOR-SCROLL-UX
 */

/**
 * Resetea el scroll de la ventana al inicio de la página (top: 0) con comportamiento instantáneo.
 */
export function scrollToTop(): void {
  if (typeof window !== "undefined") {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

/**
 * Posiciona un elemento de la página inmediatamente debajo del header sticky,
 * considerando la altura real del header o un selector personalizado.
 * 
 * @param elementId ID del elemento destino
 * @param headerSelector Selector CSS del header sticky (por defecto 'header' o '.sticky')
 */
export function scrollToElementBelowHeader(
  elementId: string,
  headerSelector: string = "header"
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const targetEl = document.getElementById(elementId);
  if (!targetEl) return;

  // Encontrar el header sticky si existe para medir su altura exacta
  let headerHeight = 0;
  const headerEl = document.querySelector(headerSelector) || document.querySelector(".sticky");
  if (headerEl) {
    headerHeight = headerEl.getBoundingClientRect().height;
  }

  const targetRect = targetEl.getBoundingClientRect();
  const absoluteTop = targetRect.top + window.scrollY;
  const destinationScroll = Math.max(0, absoluteTop - headerHeight);

  window.scrollTo({
    top: destinationScroll,
    behavior: "auto",
  });
}

/**
 * Programa una acción de scroll dentro del ciclo de renderizado usando requestAnimationFrame.
 * 
 * @param scrollFn Función de scroll a ejecutar en el siguiente frame
 */
export function scheduleScroll(scrollFn: () => void): void {
  if (typeof window !== "undefined" && typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      scrollFn();
    });
  } else {
    scrollFn();
  }
}

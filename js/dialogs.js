(() => {
  "use strict";
  const previousFocus = new WeakMap();
  const previousInert = new WeakMap();
  const focusable =
    'button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]';
  function close(modal) {
    if (!modal?.classList.contains("open")) return;
    modal.classList.remove("open");
    for (const [sibling, inert] of previousInert.get(modal) || [])
      sibling.inert = inert;
    previousFocus.get(modal)?.focus();
  }
  function open(modal) {
    if (!modal) return;
    for (const other of document.querySelectorAll(".modal-overlay.open"))
      close(other);
    previousFocus.set(modal, document.activeElement);
    modal.classList.add("open");
    modal.tabIndex = -1;
    previousInert.set(
      modal,
      [...document.body.children]
        .filter(
          (element) => element !== modal && element instanceof HTMLElement,
        )
        .map((element) => [element, element.inert]),
    );
    for (const sibling of document.body.children)
      if (sibling !== modal && sibling instanceof HTMLElement)
        sibling.inert = true;
    (modal.querySelector(focusable) || modal).focus();
  }
  document.addEventListener("keydown", (event) => {
    const modal = document.querySelector(".modal-overlay.open");
    if (!modal) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close(modal);
    }
    if (event.key === "Tab") {
      const controls = [...modal.querySelectorAll(focusable)].filter(
        (element) => element.getClientRects().length,
      );
      const first = controls[0],
        last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        modal.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === modal)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  window.Dialogs = { open, close };
})();

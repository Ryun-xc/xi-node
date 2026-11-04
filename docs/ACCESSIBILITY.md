# Accessibility

Current basics:

```text
Skip link to #viewRoot
Visible :focus-visible outline
aria-current on the active navigation item
aria-live on the view container
aria-live on the toast stack
prefers-reduced-motion support in CSS
Form controls have visible labels
```

Known gaps:

```text
No full screen-reader audit
No keyboard trap test for every modal
No high-contrast theme
No automated axe/Lighthouse regression
```

Before a 1.0 release, run:

```text
axe DevTools
Lighthouse accessibility
Keyboard-only pass
Screen-reader smoke test
```
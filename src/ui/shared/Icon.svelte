<script lang="ts" module>
  // NOTE: 24x24 stroke icons drawn for this app, one path each. They are decorative:
  // the visible text or the control's aria-label next to them carries the meaning.
  const paths = {
    scale: 'M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z',
    books: 'M4 4h4v16H4zM8 4h4v16H8zM14.2 6.6l3.4-1 3.9 13.4-3.4 1z',
    gear: 'M10.2 4.8L10.6 2.1L13.4 2.1L13.8 4.8L15.8 5.7L18 4L20 6L18.3 8.2L19.2 10.2L21.9 10.6L21.9 13.4L19.2 13.8L18.3 15.8L20 18L18 20L15.8 18.3L13.8 19.2L13.4 21.9L10.6 21.9L10.2 19.2L8.2 18.3L6 20L4 18L5.7 15.8L4.8 13.8L2.1 13.4L2.1 10.6L4.8 10.2L5.7 8.2L4 6L6 4L8.2 5.7zM12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6z',
    search: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM16 16l5 5',
    clipboard: 'M9 3h6v3H9zM9 4.5H6V21h12V4.5h-3M9 11h6M9 15h6',
    folder: 'M3 5h6l2 3h10v11H3z',
    pencil: 'M4 20l1-4L16 5l3 3L8 19zM14 7l3 3',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
    share: 'M12 15V3M8 7l4-4 4 4M5 12v8h14v-8',
    cloud: 'M7 19a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.6a4.7 4.7 0 0 1-.5 9.4z',
    warn: 'M12 3L2 20h20zM12 10v4M12 17v.01',
    check: 'M5 12.5l4.5 4.5L19 7',
    plus: 'M12 5v14M5 12h14',
    minus: 'M6 12h12',
    close: 'M6 6l12 12M18 6L6 18',
    chevron: 'M9 5l7 7-7 7',
    back: 'M15 5l-7 7 7 7',
    down: 'M5 9l7 7 7-7',
    up: 'M5 15l7-7 7 7',
    more: 'M12 5v.01M12 12v.01M12 19v.01',
    print: 'M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7z',
    table: 'M3 5h18v14H3zM3 10h18M3 14.5h18M9 5v14',
    undo: 'M8 5L4 9l4 4M4 9h10a5 5 0 0 1 0 10h-3',
    info: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18zM12 11v6M12 7.5v.01',
  } as const;
  export type IconName = keyof typeof paths;
</script>

<script lang="ts">
  const { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>

<style>
  .icon { flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vertical-align: -0.2em; }
</style>

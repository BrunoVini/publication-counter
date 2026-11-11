<script lang="ts">
  import { app, act } from '../../store/app.svelte';
  import { fmtDate, fmtNumber, i18n, t } from '../../i18n/index.svelte';
  import { openCount, startCount } from '../../domain/dataset';
  import { itemTotal } from '../../domain/calc';
  import { identityKey } from '../../domain/text';
  import { languageName, loadLanguages } from '../../domain/languages.svelte';
  import type { CountItem } from '../../domain/types';
  import { showToast } from '../shared/Toast.svelte';
  import ItemPanel from './ItemPanel.svelte';
  import Icon from '../shared/Icon.svelte';

  void loadLanguages();
  const langName = (code: string) => languageName(code, i18n.lang);

  // NOTE: jsdom has no matchMedia; without it the layout defaults to phone.
  let desktop = $state(false);
  $effect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 900px)');
    desktop = mq.matches;
    const on = (e: MediaQueryListEvent) => (desktop = e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  });

  const count = $derived(openCount(app.ds));
  const history = $derived(
    app.ds.counts.filter((c) => c.finishedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  );

  let query = $state('');
  let selectedId = $state<string | null>(null);
  let asking = $state(false);
  let name = $state('');
  let nameError = $state(false);
  let search = $state<HTMLInputElement>();

  // Reuses the identity normalisation (accents, case, spacing) for matching.
  const norm = (s: string) => identityKey({ name: s, language: '', variant: '' }).split('\u0000')[0];

  type Status = { kind: 'approx' | 'zero' | 'none' | 'attention'; n?: number };
  function statusOf(item: CountItem): Status {
    try {
      const tot = itemTotal(item, app.ds.settings.scale);
      if (!tot) return { kind: 'none' };
      return tot.units === 0 && item.zero ? { kind: 'zero' } : { kind: 'approx', n: tot.units };
    } catch {
      return { kind: 'attention' };
    }
  }
  const isDone = (item: CountItem) => item.zero || item.entries.length > 0;
  const icons = { approx: 'check', zero: 'check', none: 'minus', attention: 'warn' } as const;

  const rows = $derived.by(() => {
    if (!count) return [];
    const q = norm(query);
    return count.items.flatMap((item) => {
      const pub = app.ds.publications.find((p) => p.id === item.publicationId);
      if (!pub) return [];
      if (q && !norm(`${pub.name} ${langName(pub.language)} ${pub.variant}`).includes(q)) return [];
      return [{ item, pub, status: statusOf(item) }];
    });
  });
  const visible = $derived(app.onlyNotCounted ? rows.filter((r) => !isDone(r.item) || r.status.kind === 'attention') : rows);
  const done = $derived(count ? count.items.filter(isDone).length : 0);

  function begin() {
    name = app.ds.settings.lastCounter ?? '';
    nameError = false;
    asking = true;
  }
  function confirmName(e: SubmitEvent) {
    e.preventDefault();
    const counter = name.trim();
    if (!counter) { nameError = true; return; }
    try {
      act((ds) => startCount(ds, counter, new Date().toISOString(), () => crypto.randomUUID()));
      asking = false;
      app.openItemId = null;
      query = ''; app.onlyNotCounted = false; selectedId = null;
    } catch {
      showToast(t('count.err.start'));
    }
  }
  const modal = (dlg: HTMLDialogElement) => { dlg.showModal(); };

  function toggle(pubId: string) {
    selectedId = pubId;
    app.openItemId = app.openItemId === pubId ? null : pubId;
  }
  function createFromSearch() {
    app.pubDraftName = query.trim();
    app.tab = 'publications';
  }

  function onkey(e: KeyboardEvent) {
    if (!desktop || !count || asking) return;
    const el = e.target as HTMLElement | null;
    const typing = !!el && (['INPUT', 'TEXTAREA'].includes(el.tagName) || el.isContentEditable);
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); search?.focus(); return; }
    if (e.key === '/' && !typing) { e.preventDefault(); search?.focus(); return; }
    if (e.key === 'Escape') { app.openItemId = null; return; }
    // NOTE: other inputs (the item's fields) keep arrows and Enter for themselves.
    if (typing && el !== search) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!visible.length) return;
      e.preventDefault();
      const i = visible.findIndex((r) => r.pub.id === selectedId);
      const next = e.key === 'ArrowDown' ? Math.min(i + 1, visible.length - 1) : Math.max(i - 1, 0);
      selectedId = visible[Math.max(next, 0)].pub.id;
    } else if (e.key === 'Enter' && (el === search || !(el instanceof HTMLElement) || el === document.body)) {
      e.preventDefault();
      // NOTE: the selection may have been filtered out; only a visible item is opened.
      const target = visible.find((r) => r.pub.id === selectedId) ?? visible[0];
      if (target) app.openItemId = target.pub.id;
    }
  }
</script>

<svelte:window onkeydown={onkey} />

{#if !count}
  <div class="stack home">
    <button type="button" class="primary big wide" onclick={begin}><Icon name="plus" size={24} /> {t('count.new')}</button>
    <h2 class="sec">{t('count.history')}</h2>
    {#if history.length === 0}
      <p class="muted">{t('count.history.empty')}</p>
    {:else}
      <ul class="list">
        {#each history as c (c.id)}
          <li>
            <button type="button" class="row" onclick={() => (app.summaryCountId = c.id)}>
              <span class="main">
                <strong>{fmtDate(c.startedAt)}</strong>
                <span class="sub">{c.counter} · {t('count.items', { count: c.items.length })}</span>
              </span>
              <Icon name="chevron" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{:else}
  <div class="layout" class:desktop>
    <div class="left">
      <p class="head"><strong>{fmtDate(count.startedAt)}</strong> · {count.counter} · <span class="prog">{t('count.progress', { done, total: count.items.length })}</span></p>
      <!-- NOTE: decorative; the same progress is in the text above. -->
      <div class="meter" aria-hidden="true"><i style:width="{count.items.length ? (done / count.items.length) * 100 : 0}%"></i></div>
      <label class="field">
        <span>{t('count.search')}</span>
        <span class="search"><Icon name="search" /><input type="search" bind:this={search} bind:value={query} autocomplete="off" /></span>
      </label>
      <label class="check"><input type="checkbox" bind:checked={app.onlyNotCounted} /> {t('count.onlyUncounted')}</label>

      {#if count.items.length === 0}
        <p class="muted">{t('count.noPubs')}</p>
      {:else if query.trim() && rows.length === 0}
        <p class="muted">{t('count.noMatch', { text: query.trim() })}</p>
        <button type="button" class="primary wide" onclick={createFromSearch}><Icon name="plus" /> {t('count.create', { text: query.trim() })}</button>
      {:else if visible.length === 0}
        <p class="muted">{t('count.allCounted')}</p>
      {/if}

      <ul class="list" aria-label={t('count.list')}>
        {#each visible as { item, pub, status } (pub.id)}
          <li>
            <button type="button" class="row" class:selected={selectedId === pub.id} class:open={app.openItemId === pub.id} aria-expanded={app.openItemId === pub.id} onclick={() => toggle(pub.id)}>
              <span class="main">
                <strong>{pub.name}</strong>
                <span class="sub">{[langName(pub.language), pub.variant].filter(Boolean).join(' · ')}</span>
              </span>
              <span class="status {status.kind}">
                <Icon name={icons[status.kind]} size={18} />
                {status.kind === 'approx' ? t('count.status.approx', { n: fmtNumber(status.n ?? 0) }) : t(`count.status.${status.kind}`)}
              </span>
              <Icon name={app.openItemId === pub.id ? 'up' : 'down'} />
            </button>
            {#if !desktop && app.openItemId === pub.id}
              <ItemPanel countId={count.id} pubId={pub.id} />
            {/if}
          </li>
        {/each}
      </ul>
      <div class="sticky">
        <button type="button" class="primary big wide" onclick={() => (app.summaryCountId = count.id)}>{t('count.summary')} <Icon name="chevron" /></button>
      </div>
    </div>
    {#if desktop && app.openItemId}
      <div class="right"><ItemPanel countId={count.id} pubId={app.openItemId} /></div>
    {/if}
  </div>
{/if}

{#if asking}
  <dialog use:modal aria-labelledby="who-title" oncancel={(e) => { e.preventDefault(); asking = false; }}>
    <form class="content" onsubmit={confirmName}>
      <h2 id="who-title" class="visually-hidden">{t('count.new')}</h2>
      <p class="muted">{t('form.required')}</p>
      <label class="field">
        <span>{t('count.who')} <span aria-hidden="true">*</span></span>
        <input maxlength="200" aria-required="true" bind:value={name} autocomplete="off" aria-invalid={nameError} aria-describedby={nameError ? 'who-err' : undefined} />
      </label>
      {#if nameError}<p id="who-err" role="alert" class="err">{t('count.who.required')}</p>{/if}
      <div class="actions">
        <button type="button" onclick={() => (asking = false)}>{t('dialog.cancel')}</button>
        <button type="submit" class="primary">{t('count.start')}</button>
      </div>
    </form>
  </dialog>
{/if}

<style>
  .home { max-width: 560px; }
  .left { display: grid; gap: var(--sp-2); align-content: start; }
  .head .prog { font-weight: 700; }
  .meter { height: 8px; border-radius: 4px; background: var(--border); overflow: hidden; }
  .meter i { display: block; height: 100%; background: var(--accent); }
  .row.selected { outline: 2px solid var(--accent); outline-offset: -2px; }
  .row.open { background: var(--accent-soft); }
  .row.open .main strong { font-weight: 700; }
  /* NOTE: each status has its own icon and wording; the colour only reinforces it. */
  .status { display: inline-flex; align-items: center; gap: var(--sp-1); white-space: nowrap; font-weight: 700; }
  .status.approx, .status.zero { color: var(--accent); font-size: var(--fs-lg); }
  .status.none { color: var(--todo); font-weight: 600; }
  .status.attention { color: var(--bad); }
  .sticky { position: sticky; bottom: var(--nav-h); padding: var(--sp-2) 0; background: var(--bg); }
  .layout.desktop { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); gap: var(--sp-4); align-items: start; }
  .right { position: sticky; top: var(--sp-4); }
  @media (min-width: 900px) { .sticky { bottom: 0; } }
</style>

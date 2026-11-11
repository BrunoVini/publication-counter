<script lang="ts">
  import { untrack } from 'svelte';
  import { app, act } from '../../store/app.svelte';
  import { t } from '../../i18n/index.svelte';
  import { addPublication } from '../../domain/dataset';
  import { identityKey, parsePastedList } from '../../domain/text';
  import { showToast } from '../shared/Toast.svelte';
  import { errorMessage } from '../count/errors';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();

  let dlg: HTMLDialogElement;
  let text = $state('');
  let language = $state('');
  let error = $state('');

  // The most common language in the catalogue, or empty.
  function commonLanguage(): string {
    const n = new Map<string, number>();
    for (const p of app.ds.publications) if (p.language) n.set(p.language, (n.get(p.language) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  }

  $effect(() => {
    if (open && !dlg.open) {
      untrack(() => { text = ''; error = ''; language = commonLanguage(); });
      dlg.showModal();
    } else if (!open && dlg.open) dlg.close();
  });

  type Status = 'new' | 'paste' | 'catalogue';
  const rows = $derived.by(() => {
    // NOTE: archived publications are ignored, matching the domain's uniqueness rule.
    const known = new Set(app.ds.publications.filter((p) => !p.archived).map(identityKey));
    const seen = new Set<string>();
    return parsePastedList(text, language.trim()).map((r) => {
      const key = identityKey(r);
      const status: Status = known.has(key) ? 'catalogue' : seen.has(key) ? 'paste' : 'new';
      seen.add(key);
      return { ...r, status };
    });
  });
  const fresh = $derived(rows.filter((r) => r.status === 'new'));
  const label = { new: 'pubs.paste.new', paste: 'pubs.paste.dupPaste', catalogue: 'pubs.paste.dupCatalogue' } as const;
  const icon = { new: '+', paste: '=', catalogue: '=' } as const;

  function confirm() {
    // NOTE: snapshot first; `fresh` recomputes to empty once the rows are in the catalogue.
    const added = [...fresh];
    try {
      act((ds) => {
        for (const r of added) {
          addPublication(ds, { name: r.name, language: r.language, variant: r.variant, defaultMode: 'weigh' }, () => crypto.randomUUID());
        }
      });
      showToast(t('pubs.paste.added', { count: added.length }));
      onclose();
    } catch (e) {
      error = errorMessage(e);
    }
  }
</script>

<dialog bind:this={dlg} aria-labelledby="pl-title" oncancel={(e) => { e.preventDefault(); onclose(); }}>
  <div class="content">
    <h2 id="pl-title">{t('pubs.paste')}</h2>
    <p class="muted">{t('pubs.paste.help')}</p>
    <label class="field">
      <span>{t('pubs.paste.list')}</span>
      <textarea rows="6" bind:value={text} autocomplete="off"></textarea>
    </label>
    <label class="field">
      <span>{t('pubs.paste.language')}</span>
      <input bind:value={language} autocomplete="off" />
    </label>
    {#if rows.length}
      <table>
        <thead><tr><th>{t('pubs.name')}</th><th>{t('pubs.language')}</th><th>{t('pubs.variant')}</th><th>{t('pubs.paste.status')}</th></tr></thead>
        <tbody>
          {#each rows as r, i (i)}
            <tr class={r.status}>
              <td>{r.name}</td><td>{r.language}</td><td>{r.variant}</td>
              <td><span aria-hidden="true">{icon[r.status]}</span> <span>{t(label[r.status])}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if error}<p role="alert" class="err">{error}</p>{/if}
    <div class="actions">
      <button type="button" onclick={onclose}>{t('dialog.cancel')}</button>
      <button type="button" class="primary" disabled={fresh.length === 0} onclick={confirm}>{t('pubs.paste.add', { count: fresh.length })}</button>
    </div>
  </div>
</dialog>

<style>
  dialog { background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 12px; width: min(640px, 94vw); padding: 0; }
  .content { padding: 16px; }
  button, input { min-height: 44px; font-size: 16px; }
  textarea { font-size: 16px; }
  button { padding: 0 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); }
  button:disabled { opacity: 0.5; }
  .primary { background: var(--accent); color: var(--on-accent); border-color: var(--accent); font-weight: 700; }
  .muted { color: var(--muted); }
  .err { color: var(--bad); }
  .field { display: grid; gap: 4px; margin: 8px 0; }
  .field input, textarea { padding: 8px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); }
  tr.paste td, tr.catalogue td { color: var(--muted); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
</style>

import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';

const m = vi.hoisted(() => ({
  drive: { status: 'off', error: null as string | null, lastSyncAt: null as string | null, conflict: null as unknown },
  warmDrive: vi.fn(async () => {}),
  connect: vi.fn(async () => {}),
  reconnect: vi.fn(async () => {}),
  syncNow: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
  deleteDriveBackup: vi.fn(async () => {}),
  resolveConflict: vi.fn(async () => {}),
}));
vi.mock('../../src/store/sync.svelte', () => m);

import CloudSection from '../../src/ui/settings/CloudSection.svelte';
import ConflictDialog from '../../src/ui/shared/ConflictDialog.svelte';
import { i18n } from '../../src/i18n/index.svelte';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => {
  i18n.lang = 'en';
  m.drive.status = 'off';
  m.drive.error = null;
  m.drive.lastSyncAt = null;
  m.drive.conflict = null;
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('CloudSection', () => {
  test('not configured hides connect', () => {
    m.drive.status = 'notConfigured';
    render(CloudSection);
    expect(screen.getByText('Google Drive backup is not configured.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('connect button calls connect', async () => {
    render(CloudSection);
    expect(m.warmDrive).toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Connect Google Drive' }));
    expect(m.connect).toHaveBeenCalledTimes(1);
  });

  test('expired shows reconnect', async () => {
    m.drive.status = 'expired';
    render(CloudSection);
    expect(screen.getByText('Login expired (about 1 hour)')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(m.reconnect).toHaveBeenCalledTimes(1);
  });

  test('connected backs up and asks before disconnecting', async () => {
    m.drive.status = 'idle';
    m.drive.lastSyncAt = '2026-01-05T10:30:00.000Z';
    render(CloudSection);
    await fireEvent.click(screen.getByRole('button', { name: 'Back up now' }));
    expect(m.syncNow).toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(m.disconnect).not.toHaveBeenCalled();
    expect(screen.getByText(/stays in your Drive/)).toBeTruthy();
    const btns = screen.getAllByRole('button', { name: 'Disconnect' });
    await fireEvent.click(btns[btns.length - 1]);
    expect(m.disconnect).toHaveBeenCalledTimes(1);
  });

  test('back up now is disabled while syncing', () => {
    m.drive.status = 'syncing';
    render(CloudSection);
    expect((screen.getByRole('button', { name: 'Back up now' }) as HTMLButtonElement).disabled).toBe(true);
  });

  test('expired and error offer disconnect', () => {
    m.drive.status = 'expired';
    const r = render(CloudSection);
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
    r.unmount();
    m.drive.status = 'error';
    render(CloudSection);
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('error shows message and try again', async () => {
    m.drive.status = 'error';
    m.drive.error = 'Boom';
    render(CloudSection);
    expect(screen.getByText('Boom')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(m.syncNow).toHaveBeenCalled();
  });
});

describe('ConflictDialog', () => {
  const conflict = {
    local: { modifiedAt: '', hasOpenCount: true, publications: 3 },
    remoteSummary: { modifiedAt: '2026-01-05T10:30:00.000Z', hasOpenCount: false, publications: 7 },
  };

  test('conflict dialog shows both summaries and resolves with choice', async () => {
    m.drive.status = 'conflict';
    m.drive.conflict = conflict;
    render(ConflictDialog);
    expect(screen.getByText('unknown')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('The other version is kept as a local backup.')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: "Use this device's version" }));
    expect(m.resolveConflict).toHaveBeenCalledWith('device');
    await fireEvent.click(screen.getByRole('button', { name: 'Use the Drive version' }));
    expect(m.resolveConflict).toHaveBeenCalledWith('drive');
  });

  test('conflict dialog ignores escape and backdrop', async () => {
    m.drive.status = 'conflict';
    m.drive.conflict = conflict;
    const { container } = render(ConflictDialog);
    const dlg = container.querySelector('dialog')!;
    const ev = new Event('cancel', { cancelable: true });
    dlg.dispatchEvent(ev);
    await fireEvent.click(dlg);
    expect(ev.defaultPrevented).toBe(true);
    expect(m.resolveConflict).not.toHaveBeenCalled();
    expect(dlg.hasAttribute('open')).toBe(true);
  });

  test('conflict dialog reopens when closed while the conflict is pending', async () => {
    m.drive.status = 'conflict';
    m.drive.conflict = conflict;
    const { container } = render(ConflictDialog);
    const dlg = container.querySelector('dialog')!;
    dlg.removeAttribute('open');
    await fireEvent(dlg, new Event('close'));
    expect(dlg.hasAttribute('open')).toBe(true);
  });
});

describe('App status', () => {
  test('top-bar drive status text renders', async () => {
    const { app } = await import('../../src/store/app.svelte');
    const { emptyDataset } = await import('../../src/domain/dataset');
    const App = (await import('../../src/ui/App.svelte')).default;
    app.ds = emptyDataset('cur', { firstRunDone: true });
    m.drive.status = 'syncing';
    render(App);
    expect(screen.getByText('Drive: backing up')).toBeTruthy();
  });
});

describe('CloudSection delete backup', () => {
  test('connected shows an enabled delete button that confirms then deletes', async () => {
    m.drive.status = 'idle';
    render(CloudSection);
    const btn = screen.getByRole('button', { name: 'Delete Drive backup and disconnect' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    await fireEvent.click(btn);
    expect(m.deleteDriveBackup).not.toHaveBeenCalled();
    const buttons = screen.getAllByRole('button', { name: 'Delete Drive backup and disconnect' });
    await fireEvent.click(buttons[buttons.length - 1]);
    expect(m.deleteDriveBackup).toHaveBeenCalledTimes(1);
  });

  test('expired shows it disabled with a reconnect hint', () => {
    m.drive.status = 'expired';
    render(CloudSection);
    expect((screen.getByRole('button', { name: 'Delete Drive backup and disconnect' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Reconnect first to delete the Drive backup.')).toBeTruthy();
  });

  test('off hides it', () => {
    render(CloudSection);
    expect(screen.queryByRole('button', { name: 'Delete Drive backup and disconnect' })).toBeNull();
  });
});

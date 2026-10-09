'use client';

import { useEffect, useMemo, useState } from 'react';
import { CardFace } from '@/components/card/card-face';
import { Icon } from '@/components/icons';
import { useToast } from '@/components/toast';
import { Badge, Button, cx, ErrorState, Field, IconButton, Input, Loading, Modal, PageHeader, Panel, PanelHeader, Select, Spinner, Toggle } from '@/components/ui';
import { api, isManager, useApi, useMe } from '@/lib/api';
import { LAYOUTS, THEMES } from '@/lib/catalog';

const DISPLAY_FONTS = [
  'Cormorant Garamond',
  'Playfair Display',
  'EB Garamond',
  'Libre Baskerville',
  'Lora',
  'DM Serif Display',
  'Fraunces',
  'Instrument Sans',
  'Manrope',
  'Montserrat',
];
const BODY_FONTS = ['Instrument Sans', 'DM Sans', 'Manrope', 'Work Sans', 'Source Sans 3', 'Nunito Sans', 'Lato', 'IBM Plex Sans', 'IBM Plex Sans Arabic', 'Noto Sans Arabic'];
const BUTTON_RADIUS: Record<string, string> = {
  sharp: '2px',
  soft: '8px',
  pill: '999px',
};
const PREVIEW_TITLE = 'Head of Private Clients';
// Borderless until hovered or focused, so the colour list reads like the design
const inlineEdit = 'w-full rounded border border-transparent bg-transparent px-1 py-0.5 outline-none hover:border-linen focus:border-gold';

/* WCAG contrast, used live as colours change */
function lum(h: string) {
  const v = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * v[0]! + 0.7152 * v[1]! + 0.0722 * v[2]!;
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};
const valid = (h: string) => /^#[0-9a-fA-F]{6}$/.test(h);

export default function BrandKit() {
  const { data, error, mutate } = useApi<any>('/brand');
  const { data: me } = useMe();
  const [b, setB] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [site, setSite] = useState('');
  const [subModal, setSubModal] = useState(false);
  const toast = useToast();
  const canEdit = isManager(me?.user.role);

  useEffect(() => {
    if (data && !b) {
      setB(structuredClone(data.brand));
      setSite((data.brand.website || '').replace(/^https?:\/\//, ''));
    }
  }, [data, b]);

  const dirty = useMemo(() => data && b && JSON.stringify(b) !== JSON.stringify(data.brand), [data, b]);
  const set = (patch: any) => setB((x: any) => ({ ...x, ...patch }));

  if (error) return <ErrorState error={error} retry={() => mutate()} />;
  if (!data || !b) return <Loading />;

  const bg = b.colors[0]?.hex || '#17171B';
  const pairs = b.colors.slice(1).map((c: any) => (valid(c.hex) && valid(bg) ? contrast(c.hex, bg) : 0));
  const allPass = pairs.every((r: number) => r >= 3);
  const previewBrand = { ...b, companyName: data.companyName };
  const previewName = me?.user.name || 'Sara Khan';

  const publish = async () => {
    setBusy('publish');
    try {
      const r = await api.patch('/brand', {
        ...b,
        website: site ? `https://${site.replace(/^https?:\/\//, '')}` : '',
      });
      toast(`Brand kit published to ${r.cards.toLocaleString()} cards`);
      await mutate();
      setB(null);
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  const extract = async () => {
    setBusy('extract');
    try {
      const r = await api.post('/brand/extract', { url: site });
      set({
        colors: r.colors,
        fonts: { ...b.fonts, display: r.fonts.display, body: r.fonts.body },
        logos: { ...b.logos, icon: b.logos.icon || r.icon },
        website: r.website,
      });
      toast(r.usedAi ? 'AI proposed a brand kit from your website. Review, then publish.' : 'We read your website’s colours and fonts. Review, then publish.', 'info');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  const uploadLogo = async (slot: 'light' | 'dark' | 'icon', f?: File) => {
    if (!f) return;
    setBusy(slot);
    try {
      const r = await api.upload(f);
      set({ logos: { ...b.logos, [slot]: r.url } });
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  const uploadFont = async (f?: File) => {
    if (!f) return;
    setBusy('font');
    try {
      const r = await api.upload(f);
      set({ fonts: { ...b.fonts, customUrl: r.url } });
      toast('Font uploaded');
    } catch (e) {
      toast((e as Error).message, 'err');
    } finally {
      setBusy(null);
    }
  };

  const setColor = (i: number, patch: any) =>
    set({
      colors: b.colors.map((c: any, j: number) => (j === i ? { ...c, ...patch } : c)),
    });

  return (
    <div>
      <PageHeader
        eyebrow="Cards"
        title="Brand kit"
        desc={`One set of rules for every card. Changes apply to ${data.cards.toLocaleString()} cards when you publish.`}
        actions={
          canEdit && (
            <>
              <Button disabled={!dirty} onClick={() => setB(structuredClone(data.brand))}>
                Discard
              </Button>
              <Button variant="ink" disabled={!dirty || b.colors.some((c: any) => !valid(c.hex))} loading={busy === 'publish'} onClick={publish}>
                Publish brand changes
              </Button>
            </>
          )
        }
      />

      {canEdit && (
        <section className="mb-5 flex flex-wrap items-center gap-4 rounded-[14px] border border-gold-line bg-[#FBF6EC] px-4 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-ink text-[#E6D3A3]">
            <Icon name="sparkle" size={18} />
          </span>
          <div className="min-w-50 flex-1">
            <div className="text-[14px] font-semibold">Start from your website</div>
            <div className="text-[13px] text-stone">
              {data.aiEnabled ? 'AI reads your logo, colours and fonts and proposes a brand kit.' : 'We read your logo, colours and fonts and propose a brand kit.'}
            </div>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <label className="flex h-10.5 flex-1 items-center gap-2 rounded-lg border border-linen bg-white px-3 sm:w-85">
              <span className="text-[13px] text-stone-2">https://</span>
              <input
                aria-label="Website"
                placeholder="yourcompany.com"
                value={site}
                onChange={(e) => setSite(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              />
            </label>
            <Button variant="outline" onClick={extract} loading={busy === 'extract'} disabled={site.length < 4}>
              Extract
            </Button>
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_440px]">
        <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-5">
          <Panel>
            <PanelHeader title="Logos" sub="SVG or PNG with a transparent background" />
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['light', 'For light backgrounds', 'bg-white'],
                  ['dark', 'For dark backgrounds', 'bg-ink'],
                  ['icon', 'Icon · QR centre, wallet', 'bg-pearl'],
                ] as const
              ).map(([slot, label, bgc]) => (
                <div key={slot} className="flex flex-col gap-2">
                  <div className={cx('relative flex h-28 items-center justify-center rounded-lg border border-line', bgc)}>
                    {busy === slot ? (
                      <Spinner />
                    ) : b.logos?.[slot] ? (
                      <img src={b.logos[slot]} alt={`${label} logo`} className="max-h-16 max-w-[80%] object-contain" />
                    ) : (
                      <span className={cx('font-display text-[20px] tracking-[0.2em]', slot === 'dark' ? 'text-gold-soft' : 'text-stone-2')}>
                        {slot === 'icon' ? data.companyName[0] : data.companyName.split(' ')[0].toUpperCase()}
                      </span>
                    )}
                    {b.logos?.[slot] && canEdit && (
                      <IconButton
                        icon="x"
                        label={`Remove ${label} logo`}
                        className="absolute right-1 top-1 h-8 w-8 bg-white/80"
                        onClick={() => set({ logos: { ...b.logos, [slot]: '' } })}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-stone-2">{label}</span>
                    <label className="cursor-pointer text-[13px] text-gold-text hover:text-ink">
                      Upload
                      <input type="file" accept=".svg,.png,.webp" className="sr-only" onChange={(e) => uploadLogo(slot, e.target.files?.[0])} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Colours" sub="The first colour is the card background; the others are checked against it" />
            {/* Reads like a list; every field is still editable in place */}
            <ul className="flex flex-col divide-y divide-[#F0EBE2]">
              {b.colors.map((c: any, i: number) => {
                const r = i > 0 && valid(c.hex) && valid(bg) ? contrast(c.hex, bg) : null;
                return (
                  <li key={i} className="grid grid-cols-[44px_1fr_auto] items-center gap-x-3.5 gap-y-2 py-3 sm:grid-cols-[44px_1fr_104px_auto_36px]">
                    <label className="relative h-11 w-11 cursor-pointer overflow-hidden rounded-[10px] border border-linen" style={{ background: valid(c.hex) ? c.hex : '#fff' }}>
                      <span className="sr-only">Pick colour {c.name}</span>
                      <input
                        type="color"
                        value={valid(c.hex) ? c.hex : '#000000'}
                        onChange={(e) => setColor(i, { hex: e.target.value.toUpperCase() })}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </label>
                    <span className="flex min-w-0 flex-col">
                      <input
                        aria-label="Colour name"
                        value={c.name}
                        onChange={(e) => setColor(i, { name: e.target.value })}
                        className={cx(inlineEdit, 'text-[14px] font-semibold')}
                      />
                      <input aria-label="Used for" value={c.use} onChange={(e) => setColor(i, { use: e.target.value })} className={cx(inlineEdit, 'text-[12.5px] text-stone-2')} />
                    </span>
                    <input
                      aria-label="Hex"
                      value={c.hex}
                      onChange={(e) => setColor(i, { hex: e.target.value })}
                      className={cx(inlineEdit, 'text-right font-mono text-[12.5px]', !valid(c.hex) && 'text-err')}
                    />
                    <span className="justify-self-end">
                      {r !== null ? (
                        <Badge tone={r >= 4.5 ? 'ok' : r >= 3 ? 'warn' : 'err'}>
                          {r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large' : 'Low'} {r.toFixed(1)}:1
                        </Badge>
                      ) : (
                        <Badge>Background</Badge>
                      )}
                    </span>
                    {b.colors.length > 1 && canEdit ? (
                      <IconButton
                        icon="trash"
                        label={`Remove ${c.name}`}
                        onClick={() =>
                          set({
                            colors: b.colors.filter((_: any, j: number) => j !== i),
                          })
                        }
                      />
                    ) : (
                      <span />
                    )}
                  </li>
                );
              })}
            </ul>
            {b.colors.length < 8 && canEdit && (
              <Button
                size="sm"
                icon="plus"
                className="mt-4"
                onClick={() =>
                  set({
                    colors: [...b.colors, { name: 'Accent', use: 'Buttons', hex: '#B08D4F' }],
                  })
                }
              >
                Add colour
              </Button>
            )}
          </Panel>

          <div className="grid gap-5 md:grid-cols-2">
            <Panel>
              <PanelHeader title="Typography" />
              <div className="flex flex-col gap-4">
                <Field label="Names and headings">
                  {(id) => (
                    <Select id={id} value={b.fonts.display} onChange={(e) => set({ fonts: { ...b.fonts, display: e.target.value } })}>
                      {[...new Set([b.fonts.display, ...DISPLAY_FONTS])].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Details and buttons">
                  {(id) => (
                    <Select id={id} value={b.fonts.body} onChange={(e) => set({ fonts: { ...b.fonts, body: e.target.value } })}>
                      {[...new Set([b.fonts.body, ...BODY_FONTS])].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-[14px] text-gold-text hover:text-ink">
                {busy === 'font' ? <Spinner size={15} /> : <Icon name="upload" size={16} />}
                {b.fonts.customUrl ? 'Custom font uploaded · replace' : 'Upload your own font'}
                <input type="file" accept=".woff2,.woff,.ttf,.otf" className="sr-only" onChange={(e) => uploadFont(e.target.files?.[0])} />
              </label>
            </Panel>

            <Panel>
              <PanelHeader title="Button style" />
              <div role="radiogroup" aria-label="Button style" className="grid grid-cols-3 gap-2">
                {Object.entries(BUTTON_RADIUS).map(([id, radius]) => {
                  const on = b.buttonStyle === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ buttonStyle: id })}
                      className={cx(
                        'flex flex-col items-center gap-2 rounded-[10px] px-2 py-3 text-[12px]',
                        on ? 'border-2 border-gold bg-[#FBF6EC]' : 'border border-linen bg-white hover:border-gold',
                      )}
                    >
                      <span className="h-3.5 w-14 bg-ink" style={{ borderRadius: radius }} />
                      <span className="capitalize">{id}</span>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          <Panel>
            <PanelHeader title="What employees may change" sub="Anything switched off stays exactly as you set it" />
            <ul className="flex flex-col divide-y divide-[#F0EBE2]">
              {Object.entries(data.permissionLabels).map(([k, v]: any) => {
                const allowed = b.permissions?.[k] !== false && (k !== 'theme' || !!b.permissions?.[k]);
                return (
                  <li key={k} className="flex items-center justify-between gap-4 py-3">
                    <span>
                      <span className="block text-[14px] font-medium">{v.name}</span>
                      <span className="block text-[12.5px] text-stone-2">{v.note}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className={cx('text-[12px]', allowed ? 'text-ok' : 'text-stone-2')}>{allowed ? 'Allowed' : 'Locked'}</span>
                      <Toggle checked={allowed} onChange={(val) => set({ permissions: { ...b.permissions, [k]: val } })} label={v.name} disabled={!canEdit} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader
              title="Sub-brands"
              sub="Different looks for regions or business units"
              action={
                canEdit && (
                  <Button size="sm" icon="plus" onClick={() => setSubModal(true)}>
                    Add sub-brand
                  </Button>
                )
              }
            />
            {b.subBrands.length === 0 ? (
              <p className="text-[14px] text-stone-2">None yet. Every card uses the main brand.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-linen">
                {b.subBrands.map((s: any, i: number) => (
                  <li key={i} className="flex items-center gap-3.5 py-3">
                    <span
                      className="h-5 w-7.5 shrink-0 rounded"
                      style={{
                        background: THEMES.find((t) => t.id === s.theme)?.bg || bg,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium">{s.name}</span>
                      <span className="block text-[13px] text-stone-2">
                        When {s.field} is {s.value} → {LAYOUTS.find((l) => l.id === s.layout)?.name || 'same layout'}
                        {s.theme ? ` · ${THEMES.find((t) => t.id === s.theme)?.name}` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {data.subBrandCounts[i] !== undefined && <span className="text-[13px] text-stone-2">{data.subBrandCounts[i]} cards</span>}
                      {canEdit && (
                        <IconButton
                          icon="trash"
                          label={`Remove ${s.name}`}
                          onClick={() =>
                            set({
                              subBrands: b.subBrands.filter((_: any, j: number) => j !== i),
                            })
                          }
                        />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </fieldset>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <section className="flex flex-col gap-4 rounded-2xl bg-sand p-5">
            <div className="eyebrow text-stone-2">Preview</div>
            <CardFace layout="classic" theme="brand_solid" fields={{ name: previewName, title: PREVIEW_TITLE }} brand={previewBrand} width="100%" />
            <div className="flex flex-col gap-3 rounded-[14px] bg-white p-4.5" style={{ fontFamily: `'${b.fonts.body}', sans-serif` }}>
              <div>
                <div className="text-[24px] leading-tight" style={{ fontFamily: `'${b.fonts.display}', serif` }}>
                  {previewName}
                </div>
                <div className="mt-1 text-[12.5px] text-stone">
                  {PREVIEW_TITLE} · {data.companyName}
                </div>
              </div>
              <span
                className="flex h-10 items-center justify-center text-[13px] font-semibold text-white"
                style={{
                  background: bg,
                  borderRadius: BUTTON_RADIUS[b.buttonStyle],
                }}
              >
                Save contact
              </span>
              <span className="flex h-10 items-center justify-center border border-[#D9D2C4] text-[13px]" style={{ borderRadius: BUTTON_RADIUS[b.buttonStyle] }}>
                Share your details
              </span>
            </div>
            <p className={cx('flex items-center gap-2 rounded-[10px] bg-white px-3.5 py-3 text-[12.5px]', allPass ? 'text-ok' : 'text-warn')}>
              <Icon name={allPass ? 'checkCircle' : 'alert'} size={16} />
              {allPass ? 'All colour pairs pass accessibility contrast checks.' : 'Some colours are hard to read on the card background.'}
            </p>
          </section>
        </aside>
      </div>

      <SubBrandModal open={subModal} onClose={() => setSubModal(false)} onAdd={(s) => set({ subBrands: [...b.subBrands, s] })} />
    </div>
  );
}

function SubBrandModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (s: any) => void }) {
  const [s, setS] = useState({
    name: '',
    field: 'country',
    value: '',
    layout: 'arabic',
    theme: '',
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a sub-brand"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="ink"
            disabled={!s.name || !s.value}
            onClick={() => {
              onAdd({ ...s, theme: s.theme || undefined });
              onClose();
            }}
          >
            Add
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          {(id) => <Input id={id} placeholder="Saudi Arabia" value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />}
        </Field>
        <Field label="When">
          {(id) => (
            <Select id={id} value={s.field} onChange={(e) => setS({ ...s, field: e.target.value })}>
              <option value="country">Country</option>
              <option value="office">Office</option>
              <option value="department">Department</option>
            </Select>
          )}
        </Field>
        <Field label="Is">{(id) => <Input id={id} placeholder="Saudi Arabia" value={s.value} onChange={(e) => setS({ ...s, value: e.target.value })} />}</Field>
        <Field label="Layout">
          {(id) => (
            <Select id={id} value={s.layout} onChange={(e) => setS({ ...s, layout: e.target.value })}>
              {LAYOUTS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Colour theme">
          {(id) => (
            <Select id={id} value={s.theme} onChange={(e) => setS({ ...s, theme: e.target.value })}>
              <option value="">Same as template</option>
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  );
}

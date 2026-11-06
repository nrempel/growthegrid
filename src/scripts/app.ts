      import mlas from '../data/mlas.json';
      import { SUBJECT, greetingFor, letterBody, signOff } from '../data/letter';
      import { CERTIFIED_ON, SHARE_TEXT } from '../data/site';

      type MLA = { name: string | null; party?: string; email?: string | null; status?: string; surname?: string };
      const MLAS = mlas as Record<string, MLA>;
      const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

      // state.sign and state.personal are what the page last wrote into the letter, so an edited
      // letter can swap just those parts when the fields change.
      const state = { riding: '', edited: false, letterRiding: '', sign: '', personal: '' };

      // One polite status region for everything a screen reader would otherwise miss.
      const say = (message: string) => {
        const s = $('status');
        s.textContent = '';
        setTimeout(() => (s.textContent = message), 50);
      };
      const busy = (btn: HTMLElement, on: boolean) => (on ? btn.setAttribute('aria-disabled', 'true') : btn.removeAttribute('aria-disabled'));
      const isBusy = (btn: HTMLElement) => btn.getAttribute('aria-disabled') === 'true';

      // ---------- counter ----------
      // Hidden below 50: a tiny number discourages people.
      function showCount({ total = 0, week = 0 }: { total?: number; week?: number }) {
        const useWeek = week >= 50;
        const n = useWeek ? week : total;
        if (n < 50) return;
        $('count').textContent = n.toLocaleString('en-CA');
        $('count-label').textContent = useWeek ? 'letters started this week' : 'letters started so far';
        $('counter').hidden = false;
      }
      fetch('/api/sent').then((r) => r.json()).then(showCount).catch(() => {});

      // Which share link brought this visit (?via=foot-x, bubble-fb, sms...). Read once, then removed
      // from the address bar so a visitor who copies the URL does not pass on someone else's tag.
      const params = new URLSearchParams(location.search);
      const via = (params.get('via') ?? '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
      if (params.has('via')) {
        params.delete('via');
        const rest = params.toString();
        history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash);
      }

      // Step counts for the funnel. No cookies, no IDs, no IP: just the step, the riding and the share tag.
      function track(event: string, ...detail: string[]) {
        const body = JSON.stringify({ event, detail, riding: state.riding, via });
        try {
          navigator.sendBeacon?.('/api/event', new Blob([body], { type: 'application/json' })) ||
            fetch('/api/event', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(() => {});
        } catch {}
      }

      function recordSend() {
        if (!state.riding) return;
        fetch('/api/sent', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ riding: state.riding }),
          keepalive: true,
        })
          .then((r) => r.json())
          .then(showCount)
          .catch(() => {});
      }

      // ---------- lookup ----------
      type Ui = { btn: HTMLElement; error: HTMLElement; field: HTMLInputElement; label: string };
      const panelUi = (): Ui => ({ btn: $('find-btn'), error: $('lookup-error'), field: $<HTMLInputElement>('postal'), label: 'Find my MLA' });

      function err(u: Ui, msg: string) {
        u.error.textContent = msg;
        u.error.hidden = !msg;
        u.field.setAttribute('aria-invalid', String(!!msg));
      }

      const DOWN = 'The lookup service didn’t respond. Pick your riding from the list instead.';
      const NO_MATCH = 'That postal code didn’t match a BC riding. Check it, or pick your riding from the list.';
      function failMessage(e: any, source: string) {
        if (e?.name === 'TimeoutError' || e?.status >= 500 || e?.status === 429) return DOWN;
        if (!navigator.onLine) return 'You’re offline. Connect and try again, or pick your riding from the list.';
        track('lookup_fail', source);
        return NO_MATCH;
      }

      // Resolves true when a riding was chosen or the chooser is showing.
      async function lookup(postal: string, u: Ui) {
        const code = postal.toUpperCase().replace(/[\s-]+/g, '');
        if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(code)) {
          err(u, 'That doesn’t look like a postal code. Try something like V8V 1X4.');
          return false;
        }
        if (code[0] !== 'V') {
          err(u, 'That postal code isn’t in BC. BC postal codes start with V.');
          return false;
        }
        if (isBusy(u.btn)) return false;
        err(u, '');
        busy(u.btn, true);
        u.btn.textContent = 'Looking up…';
        say('Looking up your riding.');
        try {
          const r = await fetch(`https://represent.opennorth.ca/postcodes/${code}/`, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) throw Object.assign(new Error('http'), { status: r.status });
          const d = await r.json();
          const hits = ridingsFrom([...(d.boundaries_centroid ?? []), ...(d.boundaries_concordance ?? [])]);
          if (hits.length === 0) {
            track('lookup_fail', 'postal');
            err(u, NO_MATCH);
            return false;
          }
          if (hits.length === 1) select(hits[0], { via: 'postal' });
          else chooseAmong(hits);
          return true;
        } catch (e) {
          err(u, failMessage(e, 'postal'));
          return false;
        } finally {
          busy(u.btn, false);
          u.btn.textContent = u.label;
        }
      }

      const BC_SET = 'british-columbia-electoral-districts-2023-redistribution';
      const ridingsFrom = (boundaries: any[]) =>
        [
          ...new Set(
            boundaries
              .filter((b) => b.related?.boundary_set_url?.includes(BC_SET))
              .map((b) => b.name as string),
          ),
        ].filter((n) => Object.hasOwn(MLAS, n));

      // ---------- use my location ----------
      // Coordinates go only to OpenNorth's boundary lookup, never to us. Rounded to 3 decimals (about 100 m).
      const geoBtn = $<HTMLButtonElement>('geo');
      if ('geolocation' in navigator) geoBtn.hidden = false;
      const geoLabel = geoBtn.querySelector('span')!;
      geoBtn.addEventListener('click', () => {
        if (isBusy(geoBtn)) return;
        const u = panelUi();
        err(u, '');
        busy(geoBtn, true);
        geoLabel.textContent = 'Finding you…';
        say('Finding your location.');
        track('lookup', 'geo');
        const done = () => {
          busy(geoBtn, false);
          geoLabel.textContent = 'Use my location';
        };
        navigator.geolocation.getCurrentPosition(
          async ({ coords }) => {
            try {
              const at = `${coords.latitude.toFixed(3)},${coords.longitude.toFixed(3)}`;
              const r = await fetch(`https://represent.opennorth.ca/boundaries/${BC_SET}/?contains=${at}`, { signal: AbortSignal.timeout(8000) });
              if (!r.ok) throw Object.assign(new Error('http'), { status: r.status });
              const hits = ridingsFrom((await r.json()).objects ?? []);
              if (hits.length === 0) err(u, 'You don’t seem to be in a BC riding. Enter your postal code or pick your riding instead.');
              else if (hits.length === 1) select(hits[0], { via: 'geo' });
              else chooseAmong(hits);
            } catch (e: any) {
              err(u, e?.name === 'TimeoutError' || e?.status >= 500 || e?.status === 429 || !navigator.onLine ? DOWN : 'Your location didn’t match a BC riding. Enter your postal code or pick your riding instead.');
            } finally {
              done();
            }
          },
          (e) => {
            err(
              u,
              e.code === e.PERMISSION_DENIED
                ? 'Location is off for this site. Enter your postal code instead.'
                : 'Your location isn’t available. Enter your postal code instead.',
            );
            done();
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
        );
      });

      function chooseAmong(names: string[]) {
        const box = $('choose-buttons');
        box.innerHTML = '';
        for (const n of names) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn btn-ghost';
          b.textContent = `${n} (${MLAS[n]?.name ?? 'MLA'})`;
          b.onclick = () => select(n, { via: 'chooser' });
          box.append(b);
        }
        $('choose').hidden = false;
        $('choose').scrollIntoView({ block: 'center' });
        (box.firstElementChild as HTMLElement).focus({ preventScroll: true });
        say(`More than one riding matches. ${names.length} choices. Choose yours.`);
      }

      function select(riding: string, opts: { via?: string; restore?: boolean } = {}) {
        state.riding = riding;
        $('choose').hidden = true;
        err(panelUi(), '');
        $<HTMLSelectElement>('riding-select').value = riding;
        const m = MLAS[riding];
        $('mla-name').textContent = m?.name ?? 'Seat to be confirmed';
        const role = m?.status === 'preliminary' ? 'MLA-elect' : 'MLA';
        $('mla-meta').textContent = [m?.party ? `${m.party} ${role}` : role, `for ${riding}`].join(' ');
        const email = m?.email ?? '';
        const a = $<HTMLAnchorElement>('mla-email');
        a.textContent = email || 'Email not yet published';
        if (email) a.href = `mailto:${email}`;
        else a.removeAttribute('href');
        $('mla-match').hidden = opts.via !== 'postal';
        const warn = $('mla-warn');
        if (!m?.name || !email) {
          warn.textContent = `There’s no confirmed email for this MLA yet. After ${CERTIFIED_ON}, check leg.bc.ca/members and paste the address into your email app.`;
          warn.hidden = false;
        } else if (m.status === 'preliminary') {
          warn.textContent = `This name comes from preliminary results, and the address uses the legislature’s standard format. Final results are due by ${CERTIFIED_ON}. If your email bounces, check leg.bc.ca/members after that date.`;
          warn.hidden = false;
        } else warn.hidden = true;
        if (state.edited) retarget();
        else render();
        $('compose').hidden = false;
        if (opts.restore) return;
        track('compose');
        $('compose').scrollIntoView({ block: 'start' });
        $('mla-name').focus({ preventScroll: true });
        say(`Found your MLA: ${$('mla-name').textContent}, ${$('mla-meta').textContent}. Your letter is ready below.`);
        history.replaceState(null, '', `#act`);
      }

      // ---------- reason chips ----------
      // A chip fills the personal sentence; the visitor can still edit it, and the chip lets go when the text no longer matches.
      const why = $<HTMLInputElement>('sender-why');
      const chips = [...document.querySelectorAll<HTMLButtonElement>('.reason')];
      const syncChips = () => chips.forEach((c) => c.setAttribute('aria-pressed', String(!!why.value && why.value === c.dataset.text)));
      for (const c of chips) {
        c.addEventListener('click', () => {
          const on = c.getAttribute('aria-pressed') === 'true';
          why.value = on ? '' : c.dataset.text ?? '';
          why.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
      why.addEventListener('input', syncChips);

      // ---------- letter ----------
      const letter = () => $<HTMLTextAreaElement>('letter');
      const val = (id: string) => $<HTMLInputElement>(id).value;
      const replaceLast = (text: string, find: string, withText: string) => {
        const i = text.lastIndexOf(find);
        return i < 0 ? text : text.slice(0, i) + withText + text.slice(i + find.length);
      };
      function render() {
        const m = MLAS[state.riding];
        letter().value = letterBody({
          mlaName: m?.name ?? '',
          surname: m?.surname,
          riding: state.riding,
          senderName: val('sender-name'),
          senderAddress: val('sender-address'),
          personal: val('sender-why'),
        });
        state.letterRiding = state.riding;
        state.sign = signOff(val('sender-name'), val('sender-address'), state.riding);
        state.personal = val('sender-why').trim();
        updateLinks();
      }

      // After a hand edit the fields change only the parts the page wrote: the sign-off and the personal sentence.
      function syncEdited() {
        let t = letter().value;
        const sign = signOff(val('sender-name'), val('sender-address'), state.riding);
        if (state.sign && t.includes(state.sign)) {
          t = replaceLast(t, state.sign, sign);
          state.sign = sign;
        }
        const p = val('sender-why').trim();
        if (p !== state.personal) {
          if (state.personal && t.includes(state.personal)) {
            t = p ? t.replace(state.personal, () => p) : t.replace(`\n\n${state.personal}`, '');
            state.personal = p;
          } else if (!state.personal && p) {
            const at = t.indexOf('I live in');
            const end = at < 0 ? -1 : t.indexOf('\n\n', at);
            if (end >= 0) {
              t = `${t.slice(0, end)}\n\n${p}${t.slice(end)}`;
              state.personal = p;
            }
          }
        }
        letter().value = t;
        updateLinks();
      }

      // Choosing another riding after edits: swap only the greeting, the riding line and the fallback sign-off.
      function retarget() {
        const m = MLAS[state.riding];
        let t = letter().value;
        if (t.startsWith('Dear MLA')) {
          const nl = t.indexOf('\n');
          t = greetingFor(m?.name ?? '', m?.surname) + (nl < 0 ? '' : t.slice(nl));
        }
        if (state.letterRiding) t = t.replace(`I live in ${state.letterRiding},`, () => `I live in ${state.riding},`);
        letter().value = t;
        state.letterRiding = state.riding;
        syncEdited();
      }

      // Some mail apps cut mailto: links near 2,000 characters; past this, copy is safer.
      const MAILTO_MAX = 1800;
      function updateLinks() {
        const to = MLAS[state.riding]?.email ?? '';
        const body = letter().value;
        const enc = encodeURIComponent;
        const mailto = `mailto:${to}?subject=${enc(SUBJECT)}&body=${enc(body)}`;
        const tooLong = mailto.length > MAILTO_MAX;
        const main = $<HTMLAnchorElement>('send-mailto');
        main.href = tooLong ? '#' : mailto;
        main.textContent = tooLong ? 'Copy letter and address' : 'Open in my email app';
        main.dataset.mode = tooLong ? 'copy' : 'mailto';
        $('mode-warn').hidden = !tooLong;
        $<HTMLAnchorElement>('send-gmail').href = `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(SUBJECT)}&body=${enc(body)}`;
        $<HTMLAnchorElement>('send-outlook').href = `https://outlook.live.com/mail/0/deeplink/compose?to=${enc(to)}&subject=${enc(SUBJECT)}&body=${enc(body)}`;
      }

      for (const id of ['sender-name', 'sender-address', 'sender-why']) {
        $(id).addEventListener('input', () => {
          if (!state.edited) render();
          else syncEdited();
        });
      }
      letter().addEventListener('input', () => {
        if (!state.edited) track('letter_edited');
        state.edited = true;
        updateLinks();
      });

      const touch = matchMedia('(pointer: coarse)').matches;
      function sent(button: string, copyMode: boolean) {
        recordSend();
        track('send_click', button, touch ? 'touch' : 'pointer', val('sender-why').trim() || state.edited ? 'personal' : 'plain');
        // No "did it open?" question: a short help line covers the case where the email app didn't open,
        // and the thank-you, share buttons and update list show straight away.
        $('sent-help').textContent = copyMode
          ? 'Now paste the letter into a new email to your MLA and send it. Tap “Copy address” above for their email.'
          : 'If your email app didn’t open, tap “Copy address” and “Copy letter” above, then paste them into a new email in any app.';
        $('sent-help').hidden = false;
        const share = $('share');
        if (share.hidden) {
          share.hidden = false;
          loadTurnstile();
          share.classList.add('lit');
          share.scrollIntoView({ block: 'nearest' });
          $('share-msg').focus({ preventScroll: true });
        }
      }
      function needName(e: Event) {
        if (val('sender-name').trim() || !letter().value.includes('[Your name]')) return false;
        e.preventDefault();
        const f = $('sender-name');
        f.classList.add('need');
        f.setAttribute('aria-invalid', 'true');
        $('name-error').hidden = false;
        f.focus();
        return true;
      }
      $('send-mailto').addEventListener('click', async (e) => {
        if (needName(e)) return;
        if ($('send-mailto').dataset.mode === 'copy') {
          e.preventDefault();
          const to = MLAS[state.riding]?.email ?? '';
          if (await copy(`To: ${to}\nSubject: ${SUBJECT}\n\n${letter().value}`, $('send-mailto'), 'Copy letter and address', 'letter')) sent('copy', true);
        } else sent('mailto', false);
      });
      for (const id of ['send-gmail', 'send-outlook']) {
        $(id).addEventListener('click', (e) => {
          if (!needName(e)) sent(id.replace('send-', ''), false);
        });
      }
      $('sender-name').addEventListener('input', () => {
        $('sender-name').classList.remove('need');
        $('sender-name').removeAttribute('aria-invalid');
        $('name-error').hidden = true;
      });

      // Returns whether the text reached the clipboard. On failure the person gets the text selected to copy by hand.
      async function copy(text: string, btn: HTMLElement, label: string, what: 'letter' | 'address' | 'link', link = '') {
        const help = $('copy-help');
        let ok = true;
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = 'Copied ✓';
          help.hidden = true;
          say('Copied.');
        } catch {
          ok = false;
          btn.textContent = 'Copy failed';
          if (what === 'letter') {
            letter().focus();
            letter().select();
          } else if (what === 'address') {
            const r = document.createRange();
            r.selectNodeContents($('mla-email'));
            getSelection()?.removeAllRanges();
            getSelection()?.addRange(r);
          }
          help.textContent = what === 'link' ? `Press and hold to copy this link: ${link}` : 'Press Ctrl+C or long-press to copy.';
          help.hidden = false;
          say('Copy failed. Select the text and copy it by hand.');
        }
        setTimeout(() => (btn.textContent = label), 1800);
        return ok;
      }
      $('copy-address').addEventListener('click', (e) => copy(MLAS[state.riding]?.email ?? '', e.currentTarget as HTMLElement, 'Copy address', 'address'));
      $('copy-letter').addEventListener('click', async (e) => {
        if (needName(e)) return;
        if (await copy(`Subject: ${SUBJECT}\n\n${letter().value}`, e.target as HTMLElement, 'Copy letter', 'letter')) sent('copy', true);
      });


      // ---------- hero animation ----------
      // Pause the pulse while the hero is off screen; the OS reduce-motion setting turns it off entirely (CSS).
      const hero = document.querySelector('.hero')!;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver((es) => hero.classList.toggle('offscreen', !es[es.length - 1].isIntersecting)).observe(hero);
        // Demote the nav button while the letter section is on screen.
        new IntersectionObserver((es) => document.body.classList.toggle('in-act', es[es.length - 1].isIntersecting)).observe($('act'));
        // Also while the hero or footer, which have their own orange button, are on screen.
        const quiet = new Map<Element, boolean>();
        const quietIo = new IntersectionObserver((es) => {
          for (const e of es) quiet.set(e.target, e.isIntersecting);
          document.body.classList.toggle('nav-quiet', [...quiet.values()].some(Boolean));
        });
        quietIo.observe(hero);
        quietIo.observe(document.querySelector('.foot')!);
      }

      // ---------- hero button ----------
      // One form on the page: the hero button jumps to it with the postal box ready to type in.
      // A plain #act jump moves focus to the section, so scroll here and focus the box ourselves.
      $('hero-cta').addEventListener('click', (e) => {
        e.preventDefault();
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        $('act').scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
        $<HTMLInputElement>('postal').focus({ preventScroll: true });
        history.replaceState(null, '', '#act');
      });

      // ---------- form wiring ----------
      $('lookup').addEventListener('submit', (e) => {
        e.preventDefault();
        track('lookup', 'postal');
        lookup(val('postal'), panelUi());
      });

      // Arrow keys on a closed list must not open a riding each time: Enter or leaving the list picks.
      // Pointer and touch pick at once.
      const sel = $<HTMLSelectElement>('riding-select');
      let keyed = false;
      const pick = () => {
        if (sel.value && sel.value !== state.riding) {
          track('lookup', 'list');
          select(sel.value, { via: 'list' });
        }
      };
      sel.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          pick();
        } else keyed = true;
      });
      sel.addEventListener('change', () => {
        if (!keyed) pick();
      });
      sel.addEventListener('blur', () => {
        if (keyed) pick();
        keyed = false;
      });
      // Back from another page restores the form fields but not the letter.
      addEventListener('pageshow', () => {
        if (sel.value && sel.value !== state.riding) select(sel.value, { restore: true });
      });

      // ---------- share ----------
      // Share the canonical URL, whatever host the visitor came in on.
      const pageUrl = document.body.dataset.shareUrl || location.origin + location.pathname;
      const shareText = SHARE_TEXT;
      const enc = encodeURIComponent;
      const tagged = (via: string) => `${pageUrl}?via=${via}`;
      $<HTMLAnchorElement>('share-sms').href = `sms:?&body=${enc(`${shareText} ${tagged('sms')}`)}`;
      $<HTMLAnchorElement>('share-wa').href = `https://wa.me/?text=${enc(`${shareText} ${tagged('wa')}`)}`;
      $<HTMLAnchorElement>('share-bsky').href = `https://bsky.app/intent/compose?text=${enc(`${shareText} ${tagged('bsky')}`)}`;
      $<HTMLAnchorElement>('share-x').href = `https://x.com/intent/post?text=${enc(shareText)}&url=${enc(tagged('x'))}`;
      $<HTMLAnchorElement>('share-fb').href = `https://www.facebook.com/sharer/sharer.php?u=${enc(tagged('fb'))}`;
      for (const [id, ch] of [['share-sms', 'sms'], ['share-wa', 'wa'], ['share-bsky', 'bsky'], ['share-x', 'x'], ['share-fb', 'fb']]) {
        $(id).addEventListener('click', () => track('share', ch));
      }
      // One main action: the share sheet where there is one, else Text it (touch) or Copy link (pointer).
      const nativeBtn = $('share-native');
      if ('share' in navigator) {
        for (const id of ['share-sms', 'share-wa', 'share-fb', 'share-bsky', 'share-x']) $(id).hidden = true;
      } else {
        nativeBtn.hidden = true;
        $(touch ? 'share-sms' : 'copy-link').classList.add('chip-main');
      }
      nativeBtn.addEventListener('click', () => {
        track('share', 'native');
        navigator.share?.({ title: 'Grow the Grid BC', text: shareText, url: tagged('share') }).catch(() => {});
      });
      // Footer share: plain social links, plus copy link.
      for (const a of document.querySelectorAll<HTMLAnchorElement>('.foot-social a')) {
        a.addEventListener('click', () => track('share', a.dataset.ch ?? 'foot'));
      }
      $('foot-copy').addEventListener('click', (e) => {
        track('share', 'foot_copy');
        const btn = e.currentTarget as HTMLElement;
        copy(btn.dataset.url ?? pageUrl, btn, 'Copy link', 'link', btn.dataset.url ?? pageUrl);
      });
      // Floating share bubbles: show once the hero is gone, hide over the letter tool and the footer,
      // which have their own share buttons.
      const bar = $('sharebar');
      bar.hidden = false;
      const foot = document.querySelector('.foot')!;
      const onScreen = (el: Element) => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };
      let queued = false;
      const update = () => {
        queued = false;
        const show = !onScreen(hero) && !onScreen($('act')) && !onScreen(foot);
        bar.classList.toggle('up', show);
        bar.inert = !show;
      };
      const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
      addEventListener('scroll', queue, { passive: true });
      addEventListener('resize', queue);
      update();
      // Each bubble answers a click: a short label beside it, then back to its name.
      const flash = (el: HTMLElement, state: string, tip: string) => {
        const name = el.dataset.name ?? (el.dataset.name = el.dataset.tip ?? '');
        el.dataset.state = state;
        el.dataset.tip = tip;
        clearTimeout(Number(el.dataset.timer));
        el.dataset.timer = String(setTimeout(() => { delete el.dataset.state; el.dataset.tip = name; }, 2000));
      };
      for (const a of bar.querySelectorAll<HTMLAnchorElement>('a.bubble')) {
        a.addEventListener('click', () => {
          track('share', a.dataset.ch ?? 'bubble');
          flash(a, 'sent', `Opening ${a.dataset.name ?? a.dataset.tip}…`);
        });
      }
      const bubbleCopy = $('bubble-copy');
      bubbleCopy.addEventListener('click', async () => {
        track('share', 'bubble_copy');
        let ok = true;
        try { await navigator.clipboard.writeText(tagged('bubble_link')); } catch { ok = false; }
        flash(bubbleCopy, ok ? 'done' : 'fail', ok ? 'Link copied' : 'Copy failed');
        say(ok ? 'Link copied.' : 'Copy failed.');
      });
      // ---------- update list ----------
      // Every form.join on the page (the thank-you step and the footer) works the same way.
      // Cloudflare Turnstile guards each one. Its script loads only when someone reaches a form, so
      // most visitors never contact Cloudflare's challenge server. It stays invisible unless
      // Cloudflare wants a person to tick a box.
      type Turnstile = { render(el: HTMLElement, o: Record<string, unknown>): string; reset(id?: string): void };
      const tsWindow = window as unknown as { turnstile?: Turnstile; onTurnstileReady?: () => void };
      type JoinState = { form: HTMLFormElement; widget: string; token: string };
      const joins = [...document.querySelectorAll<HTMLFormElement>('form[data-join]')].map((form): JoinState => ({ form, widget: '', token: '' }));
      let tsReady = false;
      let tsLoading = false;
      const renderWidget = (j: JoinState) => {
        if (j.widget || !tsReady) return;
        const el = j.form.querySelector<HTMLElement>('.join-ts')!;
        j.widget = tsWindow.turnstile!.render(el, {
          sitekey: el.dataset.sitekey,
          appearance: 'interaction-only',
          theme: 'light',
          size: 'flexible',
          callback: (t: string) => (j.token = t),
          'expired-callback': () => (j.token = ''),
          'error-callback': () => (j.token = ''),
        });
      };
      const wanted = new Set<JoinState>();
      function loadTurnstile(j: JoinState | undefined = joins.find((x) => x.form.id === 'join')) {
        if (!j) return;
        wanted.add(j);
        if (tsReady) return renderWidget(j);
        if (tsLoading) return;
        tsLoading = true;
        tsWindow.onTurnstileReady = () => {
          tsReady = true;
          wanted.forEach(renderWidget);
        };
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileReady';
        s.async = true;
        document.head.append(s);
      }
      const resetTurnstile = (j: JoinState) => {
        j.token = '';
        if (j.widget) tsWindow.turnstile?.reset(j.widget);
      };

      // Opt-in only: the box starts unticked and nothing is sent without it.
      for (const j of joins) {
        const { form } = j;
        const msg = form.querySelector<HTMLElement>('.join-msg')!;
        const btn = form.querySelector<HTMLElement>('.join-btn')!;
        const field = form.querySelector<HTMLInputElement>('.join-email')!;
        field.addEventListener('focus', () => loadTurnstile(j));
        form.querySelector('.join-box')!.addEventListener('change', () => loadTurnstile(j));
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = field.value.trim();
          const box = form.querySelector<HTMLInputElement>('.join-box')!;
          // Errors mark the field, move focus to it and read the message aloud, like the letter tool's.
          const fail = (el: HTMLInputElement, text: string) => {
            msg.textContent = text;
            msg.classList.add('error');
            el.setAttribute('aria-invalid', 'true');
            el.classList.add('need');
            el.focus();
          };
          for (const el of [box, field]) {
            el.removeAttribute('aria-invalid');
            el.classList.remove('need');
          }
          msg.classList.remove('error');
          if (!box.checked) return fail(box, 'Tick the box to join.');
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail(field, 'That email doesn’t look right.');
          if (!j.token) {
            loadTurnstile(j);
            msg.textContent = 'One moment: checking you’re not a bot. Try again in a few seconds.';
            return;
          }
          if (isBusy(btn)) return;
          busy(btn, true);
          try {
            const r = await fetch('/api/subscribe', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email, consent: true, riding: state.riding, via, turnstile: j.token }),
            });
            if (r.status === 403) {
              resetTurnstile(j);
              msg.textContent = 'The bot check didn’t finish. Try again in a few seconds.';
              busy(btn, false);
              return;
            }
            if (!r.ok) throw new Error(String(r.status));
            track('join', form.id === 'join' ? 'thanks' : 'footer');
            const done = 'You’re on the list. You’ll get an email asking you to confirm, and you can leave anytime.';
            for (const other of joins) {
              other.form.replaceChildren(Object.assign(document.createElement('p'), { className: 'join-msg', textContent: done }));
            }
            say('You’re on the list.');
          } catch {
            msg.textContent = 'That didn’t work. Try again in a minute.';
            resetTurnstile(j);
            busy(btn, false);
          }
        });
      }

      $('copy-link').addEventListener('click', (e) => {
        track('share', 'copy');
        copy(tagged('link'), e.currentTarget as HTMLElement, 'Copy link', 'link', tagged('link'));
      });

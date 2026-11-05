export const SUBJECT = 'Let data centres pay to grow BC’s power supply';

// The sign-off follows this line; the page rewrites only what comes after it.
export const SIGN_MARK = 'Sincerely,\n';

export const greetingFor = (mlaName: string, surname?: string) => {
  const last = surname || mlaName.trim().split(/\s+/).slice(-1)[0] || '';
  return last ? `Dear MLA ${last},` : 'Dear MLA,';
};

// Never send a placeholder address: fall back to the riding, which still marks a constituent.
export const signOff = (name: string, address: string, riding: string) =>
  [name.trim() || '[Your name]', address.trim() || `Constituent, ${riding}`].join('\n');

// Keep the body short: the whole letter travels in a mailto: link, and some mail
// apps cut links off near 2,000 characters.
export function letterBody(opts: {
  mlaName: string;
  riding: string;
  senderName: string;
  senderAddress: string;
  personal?: string;
  surname?: string;
}) {
  const greeting = greetingFor(opts.mlaName, opts.surname);
  const sign = signOff(opts.senderName, opts.senderAddress, opts.riding);
  const personal = opts.personal?.trim() ? `\n\n${opts.personal.trim()}` : '';

  return `${greeting}

I live in ${opts.riding}, and I'm writing about BC's cap on power for new data centres.${personal}

BC Hydro can offer new data centres at most 400 MW over two years, and 15 applications asked for about 800 MW. The cap is a cabinet regulation, so the new government can change it. When it does, I'd like the new rules to say: data centres that want our power pay for more new generation and transmission than they use, with no subsidies and no cost passed to households.

They should also meet strict water limits with public reporting, include First Nations ownership in the new power, and keep their promises on Canadian-controlled capacity in their BC Hydro contracts.

Will you raise this with the Energy Minister and support a "pay to connect" rule? I'd appreciate a reply with where you stand.

${SIGN_MARK}${sign}`;
}

// Génération d'un calendrier iCalendar (RFC 5545) importable dans Outlook / Google Agenda.

const escape = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Plie les lignes à 75 octets comme l'exige la RFC.
function fold(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let current = '';
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, 'utf8') > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const compact = (iso) => iso.replace(/-/g, '');

export function buildIcs(deadlines, { alarmDays = 3 } = {}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//contrats-app//Gestion contractuelle//FR',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Échéances contractuelles',
  ];
  for (const d of deadlines) {
    const end = new Date(`${d.date}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const summary = `${d.critical ? '⚠ ' : ''}${d.title} [${d.contract_reference || d.contract_title}]`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${d.entity}-${d.entity_id}-${compact(d.date)}-${Buffer.from(d.title).toString('hex').slice(0, 16)}@contrats-app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(d.date)}`,
      `DTEND;VALUE=DATE:${compact(end.toISOString().slice(0, 10))}`,
      `SUMMARY:${escape(summary)}`,
      `DESCRIPTION:${escape(`Contrat : ${d.contract_title}\nType : ${d.kind}`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escape(summary)}`,
      `TRIGGER:-P${alarmDays}D`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

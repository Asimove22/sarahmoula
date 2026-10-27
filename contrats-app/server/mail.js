import { simpleParser } from 'mailparser';
import msgReaderModule from '@kenjiuno/msgreader';

const MsgReader = msgReaderModule.default ?? msgReaderModule;

function isoDate(value) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

/**
 * Extrait les métadonnées d'un email exporté (.eml ou .msg Outlook).
 * Retourne null si le fichier n'est pas un email.
 * @returns {Promise<null | {subject, sender, recipient, date, body, attachments: {filename, content: Buffer, mime}[]}>}
 */
export async function parseEmail(filename, buffer) {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'eml') {
    const m = await simpleParser(buffer);
    const people = (field) =>
      [field ?? []].flat().flatMap((f) => f.value ?? []).map((a) => (a.name && a.address ? `${a.name} <${a.address}>` : a.name || a.address));
    return {
      subject: m.subject || filename,
      sender: people(m.from).join(' ; ') || null,
      recipient: [...people(m.to), ...people(m.cc)].join(' ; ') || null,
      date: isoDate(m.date),
      body: (m.text ?? '').trim(),
      attachments: (m.attachments ?? [])
        .filter((a) => a.contentDisposition !== 'inline' || a.filename)
        .map((a) => ({ filename: a.filename || 'piece-jointe', content: a.content, mime: a.contentType })),
    };
  }
  if (ext === 'msg') {
    const reader = new MsgReader(new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength));
    const info = reader.getFileData();
    if (info.error) throw new Error(`Fichier .msg illisible : ${info.error}`);
    // Sur Exchange, senderEmail peut être une adresse X.500 : on préfère l'adresse SMTP.
    const email = info.senderSmtpAddress || (info.senderEmail?.includes('@') ? info.senderEmail : null);
    const sender = info.senderName && email ? `${info.senderName} <${email}>` : info.senderName || email || null;
    return {
      subject: info.subject || filename,
      sender,
      recipient: (info.recipients ?? []).map((r) => r.name || r.smtpAddress || r.email).filter(Boolean).join(' ; ') || null,
      date: isoDate(info.messageDeliveryTime || info.clientSubmitTime || info.creationTime),
      body: (info.body ?? '').trim(),
      attachments: (info.attachments ?? [])
        .filter((a) => !a.attachmentHidden)
        .flatMap((a) => {
          // Un email imbriqué ou une pièce jointe corrompue ne doit pas bloquer l'import du message.
          try {
            const att = reader.getAttachment(a);
            return [{ filename: att.fileName || a.fileName || 'piece-jointe', content: Buffer.from(att.content), mime: a.attachMimeTag || null }];
          } catch {
            return [];
          }
        }),
    };
  }
  return null;
}

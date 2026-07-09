type TemplateInput = {
  locale: string;
  payload: Record<string, unknown>;
  sensitivePayload: Record<string, unknown>;
  templateKey: string;
};

export function renderMailTemplate(input: TemplateInput) {
  const english = input.locale === 'en';
  const name = escapeHtml(String(input.payload.name ?? ''));

  if (input.templateKey === 'account-invitation') {
    const url = escapeHtml(String(input.sensitivePayload.activationUrl ?? ''));
    const username = escapeHtml(String(input.payload.username ?? ''));
    return {
      html: `<p>${english ? 'Hello' : 'Merhaba'} ${name},</p><p>${
        english
          ? 'Your Zümra workspace account is ready.'
          : 'Zümra workspace hesabınız hazır.'
      }</p><p>${english ? 'Username' : 'Kullanıcı adı'}: <strong>${username}</strong></p><p><a href="${url}">${
        english ? 'Activate account' : 'Hesabı etkinleştir'
      }</a></p>`,
      subject: english
        ? 'Activate your Zümra account'
        : 'Zümra hesabınızı etkinleştirin',
      text: `${english ? 'Username' : 'Kullanıcı adı'}: ${username}\n${url}`,
    };
  }

  if (input.templateKey === 'password-reset') {
    const url = String(input.sensitivePayload.resetUrl ?? '');
    return {
      html: `<p>${english ? 'Hello' : 'Merhaba'} ${name},</p><p><a href="${escapeHtml(url)}">${
        english ? 'Reset password' : 'Parolayı sıfırla'
      }</a></p>`,
      subject: english ? 'Reset your password' : 'Parolanızı sıfırlayın',
      text: url,
    };
  }

  if (input.templateKey === 'device-verification') {
    const otp = escapeHtml(String(input.sensitivePayload.otp ?? ''));
    return {
      html: `<p>${english ? 'Your device verification code:' : 'Cihaz doğrulama kodunuz:'}</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p>`,
      subject: english
        ? 'Verify your new device'
        : 'Yeni cihazınızı doğrulayın',
      text: otp,
    };
  }

  if (input.templateKey === 'lead-welcome') {
    const program = escapeHtml(String(input.payload.program ?? ''));
    return {
      html: `<p>${english ? 'Hello' : 'Merhaba'} ${name},</p><p>${
        english
          ? 'Thanks for reaching out — we received your request and our advisor will contact you shortly.'
          : 'Bize ulaştığınız için teşekkürler — talebinizi aldık, danışmanımız en kısa sürede sizinle iletişime geçecek.'
      }</p>${program ? `<p><strong>${program}</strong></p>` : ''}`,
      subject: english ? 'We received your request' : 'Talebinizi aldık',
      text: english ? 'We received your request.' : 'Talebinizi aldık.',
    };
  }

  if (input.templateKey === 'assignment-assigned') {
    const title = escapeHtml(String(input.payload.assignmentTitle ?? ''));
    return {
      html: `<p>${english ? 'Hello' : 'Merhaba'} ${name},</p><p>${
        english
          ? 'A new assignment has been shared with you:'
          : 'Sana yeni bir ödev paylaşıldı:'
      }</p><p><strong>${title}</strong></p>`,
      subject: english ? 'New assignment' : 'Yeni ödev',
      text: title,
    };
  }

  if (input.templateKey === 'assignment-submitted') {
    const title = escapeHtml(String(input.payload.assignmentTitle ?? ''));
    const studentName = escapeHtml(String(input.payload.studentName ?? ''));
    return {
      html: `<p>${
        english
          ? 'A student submitted an assignment:'
          : 'Bir öğrenci ödev teslim etti:'
      }</p><p><strong>${title}</strong> — ${studentName}</p>`,
      subject: english ? 'New submission' : 'Yeni teslim',
      text: `${title} — ${studentName}`,
    };
  }

  if (input.templateKey === 'assignment-graded') {
    const title = escapeHtml(String(input.payload.assignmentTitle ?? ''));
    const score = escapeHtml(String(input.payload.score ?? ''));
    const max = escapeHtml(String(input.payload.max ?? ''));
    return {
      html: `<p>${english ? 'Hello' : 'Merhaba'} ${name},</p><p>${
        english ? 'Your assignment was graded:' : 'Ödevin notlandı:'
      }</p><p><strong>${title}</strong> — ${score}/${max}</p>`,
      subject: english ? 'Assignment graded' : 'Ödevin notlandı',
      text: `${title}: ${score}/${max}`,
    };
  }

  if (input.templateKey === 'lesson-absence-report') {
    const studentName = escapeHtml(String(input.payload.studentName ?? ''));
    const reason = escapeHtml(String(input.payload.reason ?? ''));
    const note = escapeHtml(String(input.payload.note ?? ''));
    const lessonDate = formatDate(
      String(input.payload.lessonDate ?? ''),
      english ? 'en-US' : 'tr-TR',
    );
    const reasonLine = reason
      ? `<p>${english ? 'Reason' : 'Sebep'}: <strong>${reason}</strong></p>`
      : '';
    const noteLine = note
      ? `<p>${english ? 'Note' : 'Not'}: ${note}</p>`
      : '';

    return {
      html: `<p>${english ? 'Hello' : 'Merhaba'} ${name},</p><p>${
        english
          ? `${studentName} reported that they cannot attend a scheduled lesson.`
          : `${studentName} planlanan bir derse katılamayacağını bildirdi.`
      }</p><p>${english ? 'Lesson' : 'Ders'}: <strong>${escapeHtml(
        lessonDate,
      )}</strong></p>${reasonLine}${noteLine}`,
      subject: english
        ? 'Lesson absence report'
        : 'Ders katılım bildirimi',
      text: [
        english ? 'Lesson absence report' : 'Ders katılım bildirimi',
        `${english ? 'Student' : 'Öğrenci'}: ${studentName}`,
        `${english ? 'Lesson' : 'Ders'}: ${lessonDate}`,
        reason ? `${english ? 'Reason' : 'Sebep'}: ${reason}` : '',
        note ? `${english ? 'Note' : 'Not'}: ${note}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  if (input.templateKey === 'lesson-session-status-updated') {
    const status = String(input.payload.status ?? '');
    const note = escapeHtml(String(input.payload.note ?? ''));
    const lessonDate = formatDate(
      String(input.payload.lessonDate ?? ''),
      english ? 'en-US' : 'tr-TR',
    );
    const statusLabel = escapeHtml(
      lessonStatusLabel(status, english),
    );
    const noteLine = note
      ? `<p>${english ? 'Note' : 'Not'}: ${note}</p>`
      : '';

    return {
      html: `<p>${english ? 'Hello' : 'Merhaba'} ${name},</p><p>${
        english
          ? 'A lesson status was updated.'
          : 'Bir dersin durumu güncellendi.'
      }</p><p>${english ? 'Lesson' : 'Ders'}: <strong>${escapeHtml(
        lessonDate,
      )}</strong></p><p>${english ? 'Status' : 'Durum'}: <strong>${statusLabel}</strong></p>${noteLine}`,
      subject: english
        ? 'Lesson status updated'
        : 'Ders durumu güncellendi',
      text: [
        english ? 'Lesson status updated' : 'Ders durumu güncellendi',
        `${english ? 'Lesson' : 'Ders'}: ${lessonDate}`,
        `${english ? 'Status' : 'Durum'}: ${statusLabel}`,
        note ? `${english ? 'Note' : 'Not'}: ${note}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  if (input.templateKey === 'appointment-scheduled') {
    const when = escapeHtml(
      formatDate(String(input.payload.startsAt ?? ''), english ? 'en-US' : 'tr-TR'),
    );
    const greeting = english ? 'Hello' : 'Merhaba';
    const intro = english
      ? 'Your free consultation has been confirmed. Here are the details:'
      : 'Ücretsiz danışmanlık görüşmeniz onaylandı. Görüşme detayları:';
    const whenLabel = english ? 'APPOINTMENT TIME' : 'GÖRÜŞME ZAMANI';
    const closing = english
      ? 'Our advisor will reach out to you at the scheduled time. See you soon!'
      : 'Danışmanımız belirtilen saatte sizinle iletişime geçecek. Görüşmek üzere!';
    const tagline = english
      ? 'Zümra Academy — women-only online language education'
      : 'Zümra Akademi — kadınlara özel online dil eğitimi';

    const html = `<div style="background:#f4f4f8;padding:24px 12px;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ececf3;">
    <tr><td style="background:#533089;padding:22px 28px;">
      <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.5px;">ZÜMRA</span>
      <span style="color:#ffffff;font-size:11px;font-weight:600;letter-spacing:2px;opacity:.75;margin-left:4px;">AKADEMİ</span>
    </td></tr>
    <tr><td style="padding:28px 28px 8px;">
      <p style="margin:0 0 10px;font-size:16px;color:#2E286C;">${greeting} ${name},</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5b5b6b;">${intro}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6fb;border:1px solid #ece9f6;border-radius:12px;">
        <tr><td style="padding:18px 20px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#533089;font-weight:700;margin-bottom:6px;">${whenLabel}</div>
          <div style="font-size:19px;font-weight:700;color:#2E286C;">${when}</div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:12px 28px 26px;">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#7a7a88;">${closing}</p>
    </td></tr>
    <tr><td style="padding:16px 28px;background:#faf9fc;border-top:1px solid #ececf3;">
      <span style="font-size:12px;color:#a0a0ad;">${tagline}</span>
    </td></tr>
  </table>
</div>`;

    return {
      html,
      subject: english
        ? 'Your consultation is confirmed'
        : 'Görüşmeniz onaylandı',
      text: english
        ? `Your free consultation is confirmed for ${when}.`
        : `Ücretsiz danışmanlık görüşmeniz ${when} için onaylandı.`,
    };
  }

  throw new Error(`Unknown mail template: ${input.templateKey}`);
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      })[character] ?? character,
  );
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

function lessonStatusLabel(status: string, english: boolean) {
  const labels: Record<string, { en: string; tr: string }> = {
    cancelled: { en: 'Cancelled', tr: 'İptal edildi' },
    completed: { en: 'Completed', tr: 'Tamamlandı' },
    postponed: { en: 'Postponed', tr: 'Ertelendi' },
    scheduled: { en: 'Scheduled', tr: 'Planlandı' },
  };
  const label = labels[status];
  return label ? (english ? label.en : label.tr) : status;
}

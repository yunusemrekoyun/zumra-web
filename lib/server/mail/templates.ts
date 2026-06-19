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

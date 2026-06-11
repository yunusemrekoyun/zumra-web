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

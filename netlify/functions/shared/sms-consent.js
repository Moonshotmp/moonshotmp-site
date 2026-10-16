// Express SMS consent gate for the quiz funnels (TCPA).
//
// Owner: Tom, 2026-10-16. The quiz result card has its own unticked
// "Text me my results..." checkbox (sms_consent). A text goes out only when
// that box was ticked AND a phone was given. The email-updates box
// (marketingOptIn) never sends a text.
//
// The consent proof (flag, label version, timestamp) rides in the webhook
// body so the clinic can store it next to the send. Bump the version string
// whenever the checkbox label in the quiz engines changes.

export const SMS_CONSENT_VERSION = 'sms-consent-v1-2026-10-16';

// Strict: only a literal boolean true counts as consent.
export function hasSmsConsent(value) {
  return value === true;
}

export async function sendQuizSmsIfConsented({ clinicApi, headers, phone, name, quizType, smsConsent, logTag }) {
  if (!phone || !hasSmsConsent(smsConsent)) return false;
  try {
    await fetch(clinicApi + '/api/webhooks/quiz-sms', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone,
        name,
        quiz_type: quizType,
        sms_consent: true,
        sms_consent_version: SMS_CONSENT_VERSION,
        sms_consent_at: new Date().toISOString()
      })
    });
  } catch (e) {
    // Non-fatal: do not block the response.
    console.error('[' + logTag + '] Quiz SMS webhook error:', e && e.message);
  }
  return true;
}

// Sends the "confirm your email" message.
// With SMTP settings in .env (for example a Gmail app password) it sends a real
// email. Without them it prints the link in the server terminal instead,
// so the app still works on a laptop with no email setup.
import nodemailer from 'nodemailer';

export function createMailer(env = process.env) {
  const configured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

  const transport = configured
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: Number(env.SMTP_PORT) || 587,
        secure: Number(env.SMTP_PORT) === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      })
    : null;

  return {
    configured,

    // Returns { delivered: true } when a real email went out.
    async sendVerification({ to, name, link }) {
      if (!transport) {
        console.log(`\n[email not set up] Confirmation link for ${to}:\n${link}\n`);
        return { delivered: false };
      }
      await transport.sendMail({
        from: env.MAIL_FROM || env.SMTP_USER,
        to,
        subject: 'Confirm your UniNest account',
        text: verificationText(name, link),
        html: verificationHtml(name, link),
      });
      return { delivered: true };
    },
  };
}

export function verificationText(name, link) {
  return [
    `Hi ${name},`,
    '',
    'Welcome to UniNest. Please confirm your email address by opening this link:',
    link,
    '',
    'The link works for 24 hours. If you did not sign up, you can ignore this email.',
  ].join('\n');
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function verificationHtml(name, link) {
  const safeLink = escapeHtml(link);
  return `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#25282b">
    <h2 style="color:#2f9068">Welcome to UniNest</h2>
    <p>Hi ${escapeHtml(name)},</p>
    <p>Please confirm your email address to finish creating your account.</p>
    <p><a href="${safeLink}" style="display:inline-block;background:#2f9068;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Confirm my email</a></p>
    <p style="font-size:13px;color:#666">Or copy this link: ${safeLink}</p>
    <p style="font-size:13px;color:#666">The link works for 24 hours. If you did not sign up, you can ignore this email.</p>
  </div>`;
}

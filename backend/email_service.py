"""Email service using SendGrid for transactional emails."""
import os
import logging

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@fantapronostic.com")


async def send_password_reset_email(to_email: str, reset_url: str, username: str = ""):
    """Send a password reset email via SendGrid."""
    if not SENDGRID_API_KEY:
        logger.warning("[EMAIL] SendGrid API key not configured, skipping email")
        return False

    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail

    display_name = username or to_email

    html_content = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #F59E0B; font-size: 28px; margin: 0;">
          <span style="font-weight: 800;">FANTA</span><span style="font-weight: 600; color: #1F3A8A;">Pronostic</span>
        </h1>
      </div>
      <div style="background: #ffffff; border-radius: 12px; padding: 30px; border: 1px solid #e5e7eb;">
        <h2 style="color: #1f2937; margin-top: 0;">Reset Password</h2>
        <p style="color: #4b5563; line-height: 1.6;">Ciao <strong>{display_name}</strong>,</p>
        <p style="color: #4b5563; line-height: 1.6;">Hai richiesto il reset della tua password. Clicca il pulsante qui sotto per impostarne una nuova:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{reset_url}" style="background-color: #F59E0B; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
            Reimposta Password
          </a>
        </div>
        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5;">
          Se non hai richiesto il reset della password, ignora questa email. Il link scadrà tra 24 ore.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          Se il pulsante non funziona, copia e incolla questo link nel browser:<br>
          <a href="{reset_url}" style="color: #F59E0B; word-break: break-all;">{reset_url}</a>
        </p>
      </div>
      <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
        FantaPronostic - Il gioco dei pronostici sportivi
      </p>
    </div>
    """

    message = Mail(
        from_email=SENDER_EMAIL,
        to_emails=to_email,
        subject="FantaPronostic - Reset Password",
        html_content=html_content,
    )

    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        logger.info(f"[EMAIL] Password reset email sent to {to_email[:5]}*** (status: {response.status_code})")
        return response.status_code == 202
    except Exception as e:
        logger.error(f"[EMAIL] Failed to send email to {to_email[:5]}***: {e}")
        return False
